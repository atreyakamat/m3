import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { computeTransferStatus, type Decision } from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { NotificationService } from '../common/notification.service';
import { AuditService } from '../common/audit.service';
import { paginated, parsePage } from '../common/pagination';

function extractDemographics(screening: { answers?: any } | null | undefined): { age: number | null; gender: string | null } {
  if (!screening || !screening.answers || typeof screening.answers !== 'object') {
    return { age: null, gender: null };
  }
  const ans = screening.answers as Record<string, unknown>;
  const age = typeof ans.age === 'number' ? ans.age : typeof ans.age === 'string' && !isNaN(Number(ans.age)) ? Number(ans.age) : null;
  const gender = typeof ans.gender === 'string' ? ans.gender : null;
  return { age, gender };
}

@Injectable()
export class ContractorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly notify: NotificationService,
    private readonly audit: AuditService,
  ) {}

  /** Verifies that the contractor is assigned to the requested site code (primary or multi-contractor). */
  async validateContractorSite(contractorId: string, siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: { area: true },
    });
    if (!site) throw new NotFoundException(`Construction site ${siteCode} not found`);
    if (site.contractorId !== contractorId) {
      const cs = await this.prisma.contractorSite.findUnique({
        where: { contractorId_siteId: { contractorId, siteId: site.id } },
      });
      if (!cs || !cs.active) {
        throw new ForbiddenException(`You are not assigned to construction site ${siteCode}`);
      }
    }
    return site;
  }

  /** Full profile of the logged-in contractor including assigned construction sites. */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        contractor: {
          include: {
            sites: {
              where: { active: true },
              include: {
                area: true,
                _count: { select: { assignments: { where: { active: true } } } },
              },
              orderBy: { name: 'asc' },
            },
            contractorSites: {
              where: { active: true, site: { active: true } },
              include: {
                site: {
                  include: {
                    area: true,
                    _count: { select: { assignments: { where: { active: true } } } },
                  },
                },
              },
              orderBy: { site: { name: 'asc' } },
            },
          },
        },
      },
    });
    if (!user || user.role !== 'CONTRACTOR' || !user.contractor) {
      throw new ForbiddenException('Not an active contractor account');
    }

    const directSites = user.contractor.sites.map((s) => ({
      siteId: s.siteCode,
      siteCode: s.siteCode,
      name: s.name,
      area: s.area.name,
      activeWorkers: s._count.assignments,
    }));
    const multiSites = user.contractor.contractorSites.map((cs) => ({
      siteId: cs.site.siteCode,
      siteCode: cs.site.siteCode,
      name: cs.site.name,
      area: cs.site.area.name,
      activeWorkers: cs.site._count.assignments,
    }));

    const sitesMap = new Map<string, typeof directSites[0]>();
    for (const s of [...directSites, ...multiSites]) {
      if (!sitesMap.has(s.siteId)) sitesMap.set(s.siteId, s);
    }
    const assignedSites = Array.from(sitesMap.values());

    return {
      contractorId: user.stakeholderCode ?? user.contractorId ?? '',
      contractorCode: user.stakeholderCode ?? user.contractorId ?? '',
      name: user.displayName,
      phone: user.phone ?? '',
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      assignedSites,
    };
  }

  /** Aggregate worker malaria statistics for the selected construction site. */
  async getSiteStats(contractorId: string, siteCode: string) {
    const site = await this.validateContractorSite(contractorId, siteCode);

    const assignments = await this.prisma.workerSiteAssignment.findMany({
      where: { siteId: site.id, active: true },
      select: { workerId: true },
    });

    let positive = 0;
    let negative = 0;
    let awaitingResults = 0;
    let noResultRecorded = 0;

    for (const a of assignments) {
      const status = await this.admin.requireWorkerMalariaStatus(a.workerId);
      if (status === 'POSITIVE') positive++;
      else if (status === 'NEGATIVE') negative++;
      else if (status === 'AWAITING') awaitingResults++;
      else noResultRecorded++;
    }

    return {
      siteCode: site.siteCode,
      siteName: site.name,
      totalWorkers: assignments.length,
      positive,
      negative,
      awaitingResults,
      noResultRecorded,
      lastUpdated: new Date().toISOString(),
    };
  }

  /** Searchable and filterable workers list linked to the selected site. */
  async getSiteWorkers(
    contractorId: string,
    siteCode: string,
    query: { search?: string; malaria?: string; page?: string; pageSize?: string },
  ) {
    const site = await this.validateContractorSite(contractorId, siteCode);
    const params = parsePage(query.page, query.pageSize);

    const assignments = await this.prisma.workerSiteAssignment.findMany({
      where: {
        siteId: site.id,
        active: true,
        OR: [
          { contractorId },
          { contractorId: null },
        ],
      },
      include: {
        worker: {
          include: {
            screening: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const searchLower = query.search?.trim().toLowerCase();
    const rows = [];

    for (const a of assignments) {
      const w = a.worker;
      if (searchLower) {
        const matches =
          w.name.toLowerCase().includes(searchLower) ||
          w.workerCode.toLowerCase().includes(searchLower) ||
          (w.phone && w.phone.includes(searchLower)) ||
          w.id.toLowerCase().includes(searchLower);
        if (!matches) continue;
      }

      const malaria = await this.admin.requireWorkerMalariaStatus(w.id);
      const contractorMalariaStatus: 'POSITIVE' | 'NEGATIVE' | null =
        malaria === 'POSITIVE' || malaria === 'NEGATIVE' ? malaria : null;

      const rawFilter = query.malaria?.toUpperCase();
      if (rawFilter && rawFilter !== 'ALL') {
        if (rawFilter === 'POSITIVE' || rawFilter === 'NEGATIVE') {
          if (contractorMalariaStatus !== rawFilter) {
            continue;
          }
        } else {
          // Contractors may not filter on pending or unrecorded individual statuses
          continue;
        }
      }

      const demo = extractDemographics(w.screening);

      rows.push({
        workerId: w.workerCode,
        patientId: w.id,
        name: w.name,
        phone: w.phone,
        age: demo.age,
        gender: demo.gender,
        malariaStatus: contractorMalariaStatus,
      });
    }

    const total = rows.length;
    const items = rows.slice(params.skip, params.skip + params.take);
    return paginated(items, total, params);
  }

  /** Individual worker summary for contractor view (strictly authorised fields). */
  async getWorkerDetail(contractorId: string, workerCode: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { workerCode },
      include: {
        assignments: {
          where: { active: true },
          include: { site: true },
          take: 1,
        },
        screening: true,
      },
    });
    if (!worker) throw new NotFoundException(`Worker ${workerCode} not found`);

    const activeAssignment = worker.assignments[0];
    if (!activeAssignment) {
      throw new ForbiddenException('Worker is not currently assigned to any construction site');
    }
    let isAssigned = activeAssignment.contractorId === contractorId;
    if (!isAssigned && !activeAssignment.contractorId) {
      if (activeAssignment.site.contractorId === contractorId) {
        isAssigned = true;
      } else {
        const cs = await this.prisma.contractorSite.findUnique({
          where: { contractorId_siteId: { contractorId, siteId: activeAssignment.siteId } },
        });
        if (cs && cs.active) {
          isAssigned = true;
        }
      }
    }
    if (!isAssigned) {
      throw new ForbiddenException('Worker is not assigned to your workforce');
    }

    const malaria = await this.admin.requireWorkerMalariaStatus(worker.id);
    const contractorMalariaStatus: 'POSITIVE' | 'NEGATIVE' | null =
      malaria === 'POSITIVE' || malaria === 'NEGATIVE' ? malaria : null;
    const demo = extractDemographics(worker.screening);
    const dependantsCount = await this.prisma.householdMember.count({
      where: { workerId: worker.id },
    });

    return {
      workerId: worker.workerCode,
      patientId: worker.id,
      name: worker.name,
      phone: worker.phone,
      age: demo.age,
      gender: demo.gender,
      dependantsCount,
      currentSite: {
        siteId: activeAssignment.site.siteCode,
        name: activeAssignment.site.name,
      },
      malariaStatus: contractorMalariaStatus,
    };
  }

  /** Join requests for a specific construction site managed by the contractor. */
  async getSiteJoinRequests(contractorId: string, siteCode: string, status?: string) {
    const site = await this.validateContractorSite(contractorId, siteCode);

    const requests = await this.prisma.siteJoinRequest.findMany({
      where: {
        siteId: site.id,
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
      },
      include: {
        worker: {
          include: {
            screening: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: requests.map((r) => {
        const demo = extractDemographics(r.worker.screening);
        return {
          id: r.id,
          joinRequestId: r.id,
          workerId: r.worker.workerCode,
          workerName: r.worker.name,
          phone: r.worker.phone,
          age: demo.age,
          gender: demo.gender,
          siteId: site.siteCode,
          siteName: site.name,
          createdAt: r.createdAt.toISOString(),
          status: r.status,
          decidedAt: r.decidedAt?.toISOString() ?? null,
        };
      }),
      total: requests.length,
    };
  }

  /** Transfers relevant to the contractor's site. */
  async getSiteTransfers(contractorId: string, siteCode: string, status?: string) {
    const site = await this.validateContractorSite(contractorId, siteCode);

    const transfers = await this.prisma.siteTransferRequest.findMany({
      where: {
        OR: [{ fromSiteId: site.id }, { toSiteId: site.id }],
        ...(status && status !== 'ALL' ? { status: status as any } : {}),
      },
      include: {
        worker: true,
        fromSite: true,
        toSite: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: transfers.map((t) => {
        const isCurrentSite = t.fromSiteId === site.id;
        const isDestinationSite = t.toSiteId === site.id;
        const isAwaitingMyApproval =
          t.status.startsWith('PENDING') &&
          ((isCurrentSite && t.fromContractorDecision === 'PENDING') ||
            (isDestinationSite && t.toContractorDecision === 'PENDING'));

        return {
          id: t.id,
          transferId: t.id,
          workerId: t.worker.workerCode,
          workerName: t.worker.name,
          currentSite: t.fromSite ? { siteId: t.fromSite.siteCode, name: t.fromSite.name } : null,
          destinationSite: { siteId: t.toSite.siteCode, name: t.toSite.name },
          initiator: t.initiatorType,
          currentContractorApproval: t.fromContractorDecision,
          destinationContractorApproval: t.toContractorDecision,
          workerAcceptance: t.workerDecision,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          effectiveAt: t.effectiveAt?.toISOString() ?? null,
          isAwaitingMyApproval,
        };
      }),
      total: transfers.length,
    };
  }

  /** Worker travels for workers currently at the selected site. */
  async getSiteTravels(contractorId: string, siteCode: string) {
    const site = await this.validateContractorSite(contractorId, siteCode);

    const assignments = await this.prisma.workerSiteAssignment.findMany({
      where: { siteId: site.id, active: true },
      select: { workerId: true },
    });
    const workerIds = assignments.map((a) => a.workerId);
    if (workerIds.length === 0) return { items: [], total: 0 };

    const records = await this.prisma.travelRecord.findMany({
      where: {
        workerId: { in: workerIds },
      },
      include: {
        worker: { select: { workerCode: true, name: true, phone: true } },
      },
      orderBy: { departureDate: 'asc' },
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const items = [];
    for (const r of records) {
      const malaria = await this.admin.requireWorkerMalariaStatus(r.workerId);
      const contractorMalariaStatus: 'POSITIVE' | 'NEGATIVE' | null =
        malaria === 'POSITIVE' || malaria === 'NEGATIVE' ? malaria : null;
      const report = await this.prisma.travelReport.findUnique({
        where: { travelRecordId: r.id },
      });

      const dep = r.departureDate;
      const isUpcoming = dep ? dep >= now && r.status !== 'CANCELLED' : false;
      const isWithin7Days = dep ? dep >= now && dep <= horizon && r.status !== 'CANCELLED' : false;
      const isSevenDayAlert = isWithin7Days && malaria === 'POSITIVE';

      items.push({
        id: r.id,
        travelRecordId: r.id,
        workerId: r.worker.workerCode,
        workerName: r.worker.name,
        phone: r.worker.phone,
        departureDate: dep?.toISOString() ?? null,
        returnDate: r.returnDate?.toISOString() ?? null,
        destination: r.destination,
        state: r.state,
        status: r.status,
        isUpcoming,
        malariaStatus: contractorMalariaStatus,
        isSevenDayAlert,
        isPositiveWorkerAlert: isSevenDayAlert,
        departureWithin7Days: isWithin7Days,
        hasReport: Boolean(report),
        reportId: report?.id ?? null,
        reportStatus: report?.status ?? null,
      });
    }

    // Sort: active upcoming travels first, then historical/cancelled
    items.sort((a, b) => {
      if (a.isUpcoming && !b.isUpcoming) return -1;
      if (!a.isUpcoming && b.isUpcoming) return 1;
      return (a.departureDate || '').localeCompare(b.departureDate || '');
    });

    return { items, total: items.length };
  }

  /** Contractor notifications. */
  async getNotifications(contractorId: string, userId: string, unreadOnly?: boolean) {
    const where = {
      OR: [
        { audienceRole: 'CONTRACTOR' as any },
        { audienceUserId: userId },
      ],
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notification.count({
        where: {
          OR: [
            { audienceRole: 'CONTRACTOR' as any },
            { audienceUserId: userId },
          ],
          readAt: null,
        },
      }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: n.entityId,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      unread,
    };
  }

  /** Acknowledge a notification. */
  async ackNotification(id: string) {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { id, read: true };
  }

  // ---- Worker QR Pass Scanning and Assignment Requests (Spec §5, §6, §7) --------

  /** Scan a Worker QR Pass token and return minimal identity confirmation details */
  async scanWorkerPass(contractorId: string, token: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Pass token is required');
    }

    const rawToken = token.startsWith('M3PASS:v1:') ? token.replace('M3PASS:v1:', '') : token;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const passToken = await this.prisma.workerPassToken.findUnique({
      where: { tokenHash },
      include: {
        worker: {
          include: {
            assignments: {
              where: { active: true },
              include: { site: true, contractor: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!passToken) {
      throw new BadRequestException('Invalid or unknown Worker QR Pass token');
    }
    const now = new Date();
    if (passToken.expiresAt < now) {
      throw new BadRequestException('Worker QR Pass has expired (5-minute limit). Ask the worker to generate a fresh QR Pass.');
    }
    if (passToken.revokedAt) {
      throw new BadRequestException('Worker QR Pass has been revoked. Ask the worker to generate a fresh QR Pass.');
    }
    if (passToken.usedAt) {
      throw new BadRequestException('Worker QR Pass has already been used. Ask the worker to generate a fresh QR Pass.');
    }

    const worker = passToken.worker;
    const activeAssignment = worker.assignments[0] ?? null;

    // Check open transfer requests (Case D: Duplicate request prevention)
    const pendingTransfer = await this.prisma.siteTransferRequest.findFirst({
      where: {
        workerId: worker.id,
        status: { in: ['PENDING_WORKER_RESPONSE', 'PENDING_CURRENT_CONTRACTOR', 'PENDING_DESTINATION_CONTRACTOR'] },
      },
      include: { fromSite: true, toSite: true, fromContractor: true, toContractor: true },
      orderBy: { createdAt: 'desc' },
    });

    const isAssignedToCaller = !!(
      activeAssignment &&
      (activeAssignment.contractorId === contractorId ||
        (!activeAssignment.contractorId && activeAssignment.site.contractorId === contractorId))
    );

    let canRequest = true;
    let reason: string | undefined;

    if (pendingTransfer) {
      canRequest = false;
      reason = `Worker already has a pending transfer (${pendingTransfer.status}). Complete or cancel that request first.`;
    } else if (isAssignedToCaller) {
      canRequest = false;
      reason = `Worker is already assigned to your workforce at site ${activeAssignment.site.name}.`;
    }

    const currentContractor = activeAssignment?.contractor
      ? { contractorId: activeAssignment.contractor.id, name: activeAssignment.contractor.name }
      : activeAssignment?.site.contractorId
        ? { contractorId: activeAssignment.site.contractorId, name: 'Site Contractor' }
        : null;

    return {
      workerCode: worker.workerCode,
      name: worker.name,
      currentSite: activeAssignment
        ? { siteId: activeAssignment.site.siteCode, name: activeAssignment.site.name }
        : null,
      currentContractor,
      hasActiveAssignment: !!activeAssignment,
      isAssignedToCaller,
      pendingTransfer: pendingTransfer
        ? {
            id: pendingTransfer.id,
            status: pendingTransfer.status,
            fromSite: pendingTransfer.fromSite?.name ?? null,
            toSite: pendingTransfer.toSite.name,
            initiator: pendingTransfer.initiatorType,
            createdAt: pendingTransfer.createdAt.toISOString(),
          }
        : null,
      canRequest,
      reason,
      token: rawToken,
    };
  }

  /** Submit an assignment or transfer request via scanned QR pass token */
  async requestWorkerAssignment(
    contractorId: string,
    callerUserId: string,
    dto: { token: string; siteCode: string; note?: string },
  ) {
    const site = await this.validateContractorSite(contractorId, dto.siteCode);

    const rawToken = dto.token.startsWith('M3PASS:v1:') ? dto.token.replace('M3PASS:v1:', '') : dto.token;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the token row immediately (SELECT ... FOR UPDATE) to serialise concurrent consumers
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "WorkerPassToken" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      if (locked.length === 0) throw new BadRequestException('Invalid or unknown Worker QR Pass token');

      const passToken = await tx.workerPassToken.findUnique({
        where: { tokenHash },
        include: {
          worker: {
            include: {
              assignments: {
                where: { active: true },
                include: { site: true, contractor: true },
                take: 1,
              },
            },
          },
        },
      });

      if (!passToken) throw new BadRequestException('Invalid or unknown Worker QR Pass token');
      const now = new Date();
      if (passToken.expiresAt < now) {
        throw new BadRequestException('Worker QR Pass has expired (5-minute limit). Ask the worker to generate a fresh QR Pass.');
      }
      if (passToken.revokedAt) {
        throw new BadRequestException('Worker QR Pass has been revoked. Ask the worker to generate a fresh QR Pass.');
      }
      if (passToken.usedAt) {
        throw new BadRequestException('QR Pass token has already been used');
      }

      // 2. Atomic conditional consumption check (defense-in-depth)
      const consumeResult = await tx.workerPassToken.updateMany({
        where: {
          id: passToken.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
          usedById: contractorId,
        },
      });
      if (consumeResult.count === 0) {
        throw new BadRequestException('QR Pass token has already been used');
      }

      const worker = passToken.worker;
      const activeAssignment = worker.assignments[0] ?? null;

      // Duplicate transfer backstop
      const existingPending = await tx.siteTransferRequest.findFirst({
        where: {
          workerId: worker.id,
          status: { in: ['PENDING_WORKER_RESPONSE', 'PENDING_CURRENT_CONTRACTOR', 'PENDING_DESTINATION_CONTRACTOR'] },
        },
      });
      if (existingPending) {
        throw new ConflictException('Worker already has a pending transfer request');
      }

      // Self-assignment check
      if (
        activeAssignment &&
        activeAssignment.siteId === site.id &&
        (activeAssignment.contractorId === contractorId ||
          (!activeAssignment.contractorId && activeAssignment.site.contractorId === contractorId))
      ) {
        throw new BadRequestException('Worker is already assigned to your workforce at this site');
      }

      // Cases:
      // Case A: No active assignment -> Direct workforce assignment
      // Case B: Same-site contractor transfer -> Worker acceptance + current contractor release required
      // Case C: Cross-site transfer -> Worker acceptance + current contractor release required
      if (!activeAssignment) {
        const assignment = await tx.workerSiteAssignment.create({
          data: {
            workerId: worker.id,
            siteId: site.id,
            contractorId,
            active: true,
            status: 'ACTIVE',
            startedAt: now,
          },
        });

        await this.audit.record({
          actorId: contractorId,
          action: 'WORKER_ASSIGNED_VIA_QR',
          entityType: 'WorkerSiteAssignment',
          entityId: assignment.id,
          metadata: { workerId: worker.id, siteId: site.id, contractorId },
          tx,
        });

        await this.notify.notify({
          audienceRoles: ['WORKER'],
          type: 'SITE_ASSIGNMENT',
          title: 'Workforce Assignment Confirmed',
          body: `You have been directly assigned to the workforce at ${site.name}.`,
          entityType: 'WorkerSiteAssignment',
          entityId: assignment.id,
          audienceUserIds: worker.id ? [worker.id] : undefined,
          dedupeKey: `qr_direct_assign:${assignment.id}`,
          tx,
        });

        await this.notify.notify({
          audienceRoles: ['ADMIN'],
          type: 'SITE_ASSIGNMENT',
          title: 'Worker Assigned via QR',
          body: `Worker ${worker.workerCode} was directly assigned to site ${site.name}.`,
          entityType: 'WorkerSiteAssignment',
          entityId: assignment.id,
          dedupeKey: `admin_qr_direct_assign:${assignment.id}`,
          tx,
        });

        return {
          directAssignment: true,
          assignmentId: assignment.id,
          workerId: worker.workerCode,
          workerName: worker.name,
          siteCode: site.siteCode,
          siteName: site.name,
          status: 'ASSIGNED',
          message: 'Worker assigned to workforce successfully',
          createdAt: now.toISOString(),
        };
      }

      const fromSiteId = activeAssignment.siteId;
      const fromContractorId = activeAssignment.contractorId ?? activeAssignment.site.contractorId ?? null;
      const toSiteId = site.id;
      const toContractorId = contractorId;

      const decisions = {
        worker: 'PENDING' as Decision,
        fromContractor: fromContractorId ? ('PENDING' as Decision) : ('APPROVED' as Decision),
        toContractor: 'APPROVED' as Decision,
      };
      const status = computeTransferStatus('CONTRACTOR', decisions);

      const created = await tx.siteTransferRequest.create({
        data: {
          workerId: worker.id,
          fromSiteId,
          toSiteId,
          fromContractorId,
          toContractorId,
          initiatorType: 'CONTRACTOR',
          initiatorId: contractorId,
          status,
          toContractorDecision: 'APPROVED',
          toContractorDecisionAt: now,
          fromContractorDecision: decisions.fromContractor,
          fromContractorDecisionAt: fromContractorId ? null : now,
          note: dto.note ?? null,
        },
      });

      await this.audit.record({
        actorId: contractorId,
        action: 'WORKER_REQUEST_VIA_QR',
        entityType: 'SiteTransferRequest',
        entityId: created.id,
        metadata: {
          workerId: worker.id,
          toSiteId: site.id,
          toContractorId,
          fromSiteId,
          fromContractorId,
        },
        tx,
      });

      // Notify Worker
      await this.notify.notify({
        audienceRoles: ['WORKER'],
        type: 'TRANSFER_REQUEST',
        title: 'Workforce Assignment Request',
        body: `A contractor has requested to add you to their workforce at ${site.name}. Tap to accept or reject.`,
        entityType: 'SiteTransferRequest',
        entityId: created.id,
        audienceUserIds: worker.id ? [worker.id] : undefined,
        dedupeKey: `qr_assign_req:${created.id}`,
        tx,
      });

      // Notify Admin
      await this.notify.notify({
        audienceRoles: ['ADMIN'],
        type: 'TRANSFER_REQUEST',
        title: 'Workforce Assignment Request Submitted',
        body: `Contractor requested worker ${worker.workerCode} for site ${site.name}.`,
        entityType: 'SiteTransferRequest',
        entityId: created.id,
        dedupeKey: `admin_qr_assign_req:${created.id}`,
        tx,
      });

      return {
        directAssignment: false,
        transferId: created.id,
        id: created.id,
        workerId: worker.workerCode,
        workerName: worker.name,
        siteCode: site.siteCode,
        siteName: site.name,
        status: created.status,
        message: 'Transfer request submitted. Awaiting approvals.',
        createdAt: created.createdAt.toISOString(),
      };
    });
  }

  /** Check if a worker mobile number is already registered (Add Worker workflow) */
  async checkWorkerPhone(phone: string) {
    if (!phone) throw new BadRequestException('Phone number is required');
    const worker = await this.prisma.worker.findUnique({
      where: { phone: phone.trim() },
      include: {
        assignments: {
          where: { active: true },
          include: { site: true, contractor: true },
          take: 1,
        },
      },
    });

    if (!worker) {
      return { exists: false };
    }

    const activeAssignment = worker.assignments[0] ?? null;
    return {
      exists: true,
      workerCode: worker.workerCode,
      name: worker.name,
      currentSite: activeAssignment
        ? { siteId: activeAssignment.site.siteCode, name: activeAssignment.site.name }
        : null,
      currentContractor: activeAssignment?.contractor?.name ?? null,
    };
  }
}
