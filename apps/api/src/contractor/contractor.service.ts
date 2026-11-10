import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { computeTransferStatus, type Decision, TRANSFER_TERMINAL_STATUSES } from '@m3/shared';
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
        workerCode: w.workerCode,
        patientId: w.id,
        name: w.name,
        phone: w.phone,
        age: demo.age,
        gender: demo.gender,
        active: a.active,
        assignmentStatus: a.status ?? (a.active ? 'ACTIVE' : 'ENDED'),
        startedAt: a.startedAt.toISOString(),
        siteCode: site.siteCode,
        siteName: site.name,
        malariaStatus: null, // Masked per Iteration 2 privacy requirement
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
          include: { site: true },
          orderBy: { startedAt: 'desc' },
        },
        screening: true,
      },
    });
    if (!worker) throw new NotFoundException(`Worker ${workerCode} not found`);

    const sites = await this.getContractorSites(contractorId);
    const siteIds = sites.map((s) => s.id);

    // Verify worker belongs to contractor's workforce
    const assignment = worker.assignments.find(
      (a) => a.contractorId === contractorId || siteIds.includes(a.siteId),
    );
    if (!assignment) {
      throw new ForbiddenException('Worker is not assigned to your workforce');
    }

    const activeAssignment = worker.assignments.find((a) => a.active) ?? assignment;
    const demo = extractDemographics(worker.screening);

    // Entry in Goa history (direction: ENTERING_GOA)
    const entryTravels = await this.prisma.travelRecord.findMany({
      where: {
        workerId: worker.id,
        direction: 'ENTERING_GOA',
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        originTown: true,
        originDistrict: true,
        originState: true,
        purpose: true,
        arrivalConfirmedAt: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Exit from Goa history (direction: LEAVING_GOA)
    const exitTravels = await this.prisma.travelRecord.findMany({
      where: {
        workerId: worker.id,
        direction: 'LEAVING_GOA',
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        destination: true,
        town: true,
        state: true,
        departureDate: true,
        returnDate: true,
        purpose: true,
        departureStatus: true,
        status: true,
        createdAt: true,
      },
      orderBy: { departureDate: 'desc' },
    });

    // Relevant transfer status
    const transfers = await this.prisma.siteTransferRequest.findMany({
      where: {
        workerId: worker.id,
      },
      select: {
        id: true,
        fromSite: { select: { siteCode: true, name: true } },
        toSite: { select: { siteCode: true, name: true } },
        initiatorType: true,
        status: true,
        createdAt: true,
        effectiveAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      workerId: worker.workerCode,
      workerCode: worker.workerCode,
      patientId: worker.id,
      name: worker.name,
      phone: worker.phone,
      age: demo.age,
      gender: demo.gender,
      currentSite: {
        siteId: activeAssignment.site.siteCode,
        siteCode: activeAssignment.site.siteCode,
        name: activeAssignment.site.name,
        startedAt: activeAssignment.startedAt ? activeAssignment.startedAt.toISOString() : null,
      },
      active: activeAssignment.active,
      assignmentStatus: activeAssignment.status ?? (activeAssignment.active ? 'ACTIVE' : 'ENDED'),
      startedAt: activeAssignment.startedAt ? activeAssignment.startedAt.toISOString() : null,
      malariaStatus: null, // Strictly masked per Iteration 2 privacy requirement
      entryHistory: entryTravels.map((t) => ({
        id: t.id,
        originTown: t.originTown,
        originDistrict: t.originDistrict,
        originState: t.originState,
        purpose: t.purpose,
        arrivalDate: t.arrivalConfirmedAt ? t.arrivalConfirmedAt.toISOString() : t.createdAt.toISOString(),
        status: t.status,
      })),
      exitHistory: exitTravels.map((t) => ({
        id: t.id,
        destination: t.destination || t.town || 'Hometown',
        town: t.town,
        state: t.state,
        departureDate: t.departureDate ? t.departureDate.toISOString() : t.createdAt.toISOString(),
        returnDate: t.returnDate ? t.returnDate.toISOString() : null,
        purpose: t.purpose,
        status: t.departureStatus ?? t.status,
      })),
      transfers: transfers.map((tr) => ({
        id: tr.id,
        fromSite: tr.fromSite ? { siteCode: tr.fromSite.siteCode, name: tr.fromSite.name } : null,
        toSite: { siteCode: tr.toSite.siteCode, name: tr.toSite.name },
        initiator: tr.initiatorType,
        status: tr.status,
        createdAt: tr.createdAt.toISOString(),
        effectiveAt: tr.effectiveAt ? tr.effectiveAt.toISOString() : null,
      })),
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

  /** Retrieves all ConstructionSite entities managed by or associated with this contractor. */
  async getContractorSites(contractorId: string) {
    const directSites = await this.prisma.constructionSite.findMany({
      where: { contractorId, active: true },
      include: {
        area: true,
        _count: { select: { assignments: { where: { active: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    const multiSites = await this.prisma.contractorSite.findMany({
      where: { contractorId, active: true, site: { active: true } },
      include: {
        site: {
          include: {
            area: true,
            _count: { select: { assignments: { where: { active: true } } } },
          },
        },
      },
      orderBy: { site: { name: 'asc' } },
    });

    const sitesMap = new Map<string, typeof directSites[0]>();
    for (const s of directSites) {
      sitesMap.set(s.id, s);
    }
    for (const ms of multiSites) {
      if (!sitesMap.has(ms.site.id)) {
        sitesMap.set(ms.site.id, ms.site);
      }
    }
    return Array.from(sitesMap.values());
  }

  /**
   * List construction sites assigned to contractor with optional search filter by name, area, or code.
   */
  async getContractorSitesList(contractorId: string, search?: string) {
    const sites = await this.getContractorSites(contractorId);
    let result = sites.map((s) => ({
      siteId: s.siteCode,
      siteCode: s.siteCode,
      name: s.name,
      area: s.area.name,
      activeWorkers: s._count.assignments,
      active: s.active,
    }));
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.area.toLowerCase().includes(q) ||
          s.siteCode.toLowerCase().includes(q),
      );
    }
    return result;
  }

  /**
   * Contractor Dashboard aggregate data (Iteration 1).
   * Calculates the 4 required summary cards:
   * - Total Assigned Workers
   * - Active Workers
   * - Workers Currently at Site
   * - Pending Transfer Requests
   * Plus 4 dashboard sections: Recent Worker Activity, Site Overview, Worker Management, Transfer Requests.
   * Strictly enforces data isolation to the authenticated contractor's workforce.
   */
  async getDashboard(contractorId: string, userId: string) {
    const contractor = await this.prisma.contractor.findUnique({
      where: { id: contractorId },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, displayName: true, stakeholderCode: true },
    });

    const sites = await this.getContractorSites(contractorId);
    const siteIds = sites.map((s) => s.id);

    // 1. Total assigned & active workers
    const allAssignments = await this.prisma.workerSiteAssignment.findMany({
      where: {
        OR: [
          { contractorId },
          { siteId: { in: siteIds } },
        ],
      },
      select: { workerId: true, active: true },
    });
    const distinctTotalWorkerIds = Array.from(new Set(allAssignments.map((a) => a.workerId)));
    const totalAssignedWorkers = distinctTotalWorkerIds.length;

    const activeAssignments = allAssignments.filter((a) => a.active);
    const distinctActiveWorkerIds = Array.from(new Set(activeAssignments.map((a) => a.workerId)));
    const activeWorkers = distinctActiveWorkerIds.length;

    // 2. Workers Currently at Site (active workers not currently departed on open travel away from Goa)
    const now = new Date();
    const activeTravels = await this.prisma.travelRecord.findMany({
      where: {
        workerId: { in: distinctActiveWorkerIds },
        status: { not: 'CANCELLED' },
        direction: 'LEAVING_GOA',
        departureDate: { lte: now },
        arrivalConfirmedAt: null,
        departureStatus: { not: 'REJECTED' },
      },
      select: { workerId: true },
    });
    const awayWorkerIds = new Set(activeTravels.map((t) => t.workerId));
    const workersCurrentlyAtSite = Math.max(0, activeWorkers - awayWorkerIds.size);

    // 3. Pending Transfer Requests involving this contractor or sites
    const pendingTransfers = await this.prisma.siteTransferRequest.findMany({
      where: {
        status: { notIn: TRANSFER_TERMINAL_STATUSES as any },
        OR: [
          { fromContractorId: contractorId },
          { toContractorId: contractorId },
          { fromSiteId: { in: siteIds } },
          { toSiteId: { in: siteIds } },
        ],
      },
      include: {
        worker: { select: { workerCode: true, name: true } },
        fromSite: { select: { siteCode: true, name: true } },
        toSite: { select: { siteCode: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const pendingTransferRequests = pendingTransfers.length;

    // 4. Recent Worker Activity (authorized workforce events with timestamps)
    const recentAssignments = await this.prisma.workerSiteAssignment.findMany({
      where: {
        OR: [
          { contractorId },
          { siteId: { in: siteIds } },
        ],
      },
      include: {
        worker: { select: { workerCode: true, name: true } },
        site: { select: { siteCode: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 6,
    });

    const recentTravels = await this.prisma.travelRecord.findMany({
      where: {
        workerId: { in: distinctTotalWorkerIds },
        status: { not: 'CANCELLED' },
      },
      include: {
        worker: { select: { workerCode: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const recentTransfers = await this.prisma.siteTransferRequest.findMany({
      where: {
        OR: [
          { fromContractorId: contractorId },
          { toContractorId: contractorId },
          { fromSiteId: { in: siteIds } },
          { toSiteId: { in: siteIds } },
        ],
      },
      include: {
        worker: { select: { workerCode: true, name: true } },
        fromSite: { select: { siteCode: true, name: true } },
        toSite: { select: { siteCode: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const activities = [
      ...recentAssignments.map((a) => ({
        id: `assign-${a.id}`,
        type: 'ASSIGNMENT' as const,
        title: 'Worker Assigned',
        description: `${a.worker.name} (${a.worker.workerCode}) assigned to ${a.site.name}`,
        timestamp: a.startedAt.toISOString(),
        workerCode: a.worker.workerCode,
        workerName: a.worker.name,
        siteCode: a.site.siteCode,
        siteName: a.site.name,
      })),
      ...recentTravels.map((t) => ({
        id: `travel-${t.id}`,
        type: 'TRAVEL' as const,
        title: t.direction === 'LEAVING_GOA' ? 'Travel Departure' : 'Travel Arrival',
        description: `${t.worker.name} (${t.worker.workerCode}) ${
          t.direction === 'LEAVING_GOA'
            ? `departed for ${t.destination || t.state || 'hometown'}`
            : `returned to Goa from ${t.originTown || t.originState || 'travel'}`
        }`,
        timestamp: (t.departureDate ?? t.createdAt).toISOString(),
        workerCode: t.worker.workerCode,
        workerName: t.worker.name,
        siteCode: null,
        siteName: null,
      })),
      ...recentTransfers.map((t) => ({
        id: `transfer-${t.id}`,
        type: 'TRANSFER' as const,
        title: `Site Transfer (${t.status.replace(/_/g, ' ')})`,
        description: `Transfer for ${t.worker.name} from ${t.fromSite?.name ?? 'Site'} to ${t.toSite.name}`,
        timestamp: t.createdAt.toISOString(),
        workerCode: t.worker.workerCode,
        workerName: t.worker.name,
        siteCode: t.toSite.siteCode,
        siteName: t.toSite.name,
      })),
    ];

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const recentActivity = activities.slice(0, 10);

    // 5. Worker Management section preview
    const activeWorkerRows = await this.prisma.workerSiteAssignment.findMany({
      where: {
        active: true,
        OR: [
          { contractorId },
          { siteId: { in: siteIds } },
        ],
      },
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
            screening: { select: { answers: true } },
          },
        },
        site: { select: { siteCode: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const workers = [];
    for (const row of activeWorkerRows) {
      const demo = extractDemographics(row.worker.screening);
      workers.push({
        workerCode: row.worker.workerCode,
        workerId: row.worker.workerCode,
        patientId: row.worker.id,
        name: row.worker.name,
        phone: row.worker.phone,
        age: demo.age,
        gender: demo.gender,
        siteCode: row.site.siteCode,
        siteName: row.site.name,
        active: true,
        assignmentStatus: row.status ?? 'ACTIVE',
        malariaStatus: null, // Strictly masked per Iteration 2 privacy policy
      });
    }

    // 6. Sites overview
    const siteOverview = sites.map((s) => ({
      id: s.id,
      siteId: s.siteCode,
      siteCode: s.siteCode,
      name: s.name,
      area: s.area.name,
      activeWorkers: s._count.assignments,
    }));

    // 7. Formatted pending transfers
    const formattedPendingTransfers = pendingTransfers.slice(0, 5).map((t) => {
      const isCurrent = t.fromContractorId === contractorId || siteIds.includes(t.fromSiteId ?? '');
      const isDestination = t.toContractorId === contractorId || siteIds.includes(t.toSiteId);
      const isAwaitingMyApproval =
        (isCurrent && t.fromContractorDecision === 'PENDING') ||
        (isDestination && t.toContractorDecision === 'PENDING');
      return {
        id: t.id,
        transferId: t.id,
        workerCode: t.worker.workerCode,
        workerName: t.worker.name,
        currentSite: t.fromSite ? { siteId: t.fromSite.siteCode, name: t.fromSite.name } : null,
        destinationSite: { siteId: t.toSite.siteCode, name: t.toSite.name },
        initiator: t.initiatorType,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        isAwaitingMyApproval,
      };
    });

    return {
      contractor: {
        id: contractorId,
        contractorCode: user?.stakeholderCode ?? contractorId,
        name: contractor?.name ?? user?.displayName ?? 'Contractor',
        phone: user?.phone ?? '',
      },
      metrics: {
        totalAssignedWorkers,
        activeWorkers,
        workersCurrentlyAtSite,
        pendingTransferRequests,
      },
      sites: siteOverview,
      recentActivity,
      workers,
      pendingTransfers: formattedPendingTransfers,
    };
  }

  /** Search and list workers assigned to this contractor across all sites (with search, pagination). */
  async getContractorWorkers(
    contractorId: string,
    query: {
      search?: string;
      siteCode?: string;
      assignmentStatus?: string;
      status?: string;
      malaria?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const sites = await this.getContractorSites(contractorId);
    let targetSiteIds = sites.map((s) => s.id);

    if (query.siteCode && query.siteCode !== 'ALL') {
      const match = sites.find((s) => s.siteCode === query.siteCode);
      if (!match) throw new ForbiddenException(`You are not assigned to construction site ${query.siteCode}`);
      targetSiteIds = [match.id];
    }

    const params = parsePage(query.page, query.pageSize);
    const statusFilter = (query.assignmentStatus || query.status || 'ALL').toUpperCase();

    const assignments = await this.prisma.workerSiteAssignment.findMany({
      where: {
        siteId: { in: targetSiteIds },
        ...(statusFilter === 'ACTIVE'
          ? { active: true }
          : statusFilter === 'INACTIVE' || statusFilter === 'ENDED'
          ? { active: false }
          : statusFilter === 'TRANSFERRED'
          ? { status: 'TRANSFERRED' }
          : {}),
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
        site: {
          select: { siteCode: true, name: true },
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
          (w.phone && w.phone.includes(searchLower));
        if (!matches) continue;
      }

      const demo = extractDemographics(w.screening);

      rows.push({
        workerCode: w.workerCode,
        workerId: w.workerCode,
        patientId: w.id,
        name: w.name,
        phone: w.phone,
        age: demo.age,
        gender: demo.gender,
        siteCode: a.site.siteCode,
        siteName: a.site.name,
        active: a.active,
        assignmentStatus: a.status ?? (a.active ? 'ACTIVE' : 'ENDED'),
        startedAt: a.startedAt.toISOString(),
        malariaStatus: null, // Strictly masked per Iteration 2 privacy policy
      });
    }

    const total = rows.length;
    const items = rows.slice(params.skip, params.skip + params.take);
    return paginated(items, total, params);
  }

  /** Detailed view of a specific site assigned to the contractor. */
  async getContractorSiteDetail(contractorId: string, siteCode: string) {
    const site = await this.validateContractorSite(contractorId, siteCode);
    const stats = await this.getSiteStats(contractorId, siteCode);
    const workersRes = await this.getSiteWorkers(contractorId, siteCode, { pageSize: '25' });
    const travelsRes = await this.getSiteTravels(contractorId, siteCode);
    const transfersRes = await this.getSiteTransfers(contractorId, siteCode);

    return {
      site: {
        id: site.id,
        siteCode: site.siteCode,
        name: site.name,
        area: site.area.name,
        address: site.address,
        landmark: site.landmark,
        contactPhone: site.contactPhone,
        active: site.active,
        createdAt: site.createdAt ? site.createdAt.toISOString() : null,
      },
      stats,
      workers: workersRes.items,
      totalWorkers: workersRes.total,
      travels: travelsRes.items,
      transfers: transfersRes.items,
    };
  }
}
