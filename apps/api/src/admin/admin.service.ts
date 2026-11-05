import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  STAKEHOLDER_ID_PREFIX,
  TRANSFER_TERMINAL_STATUSES,
  deriveMalariaStatus,
  formatStakeholderId,
  ALLOWED_CORRECTION_FIELDS,
  type CreateAdminSiteInput,
  type CreateAdminUserInput,
  type DiagnosticResultValue,
  type MalariaStatus,
  type ProvisionableRole,
  type ResetAdminUserPinInput,
  type TravelReportReviewInput,
  type UpdateAdminSiteInput,
  type ReviewCorrectionInput,
} from '@m3/shared';
import type {
  DiagnosticResultValue as PrismaDiagnosticResultValue,
  JoinRequestStatus,
  PlasmodiumSpecies,
  Prisma,
  Role as PrismaRole,
  TestType,
  TravelReportStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { paginated, parsePage } from '../common/pagination';

const SITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Temp PIN lifecycle: same cost factor as the rest of the platform. */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  // ---- helpers --------------------------------------------------------------

  private async uniqueSiteCode(): Promise<string> {
    for (let i = 0; i < 10; i += 1) {
      let s = '';
      for (let j = 0; j < 6; j += 1) {
        s += SITE_CODE_ALPHABET[Math.floor(Math.random() * SITE_CODE_ALPHABET.length)];
      }
      const code = `SITE-${s}`;
      const existing = await this.prisma.constructionSite.findUnique({ where: { siteCode: code } });
      if (!existing) return code;
    }
    return `SITE-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Allocates the next role-scoped stakeholder ID (C000001, HW000001, …).
   * An advisory transaction-level lock serialises concurrent creations so the
   * generated ID is unique even under simultaneous account creation; the DB
   * unique constraint is the final backstop (spec §7.1).
   */
  private async allocateStakeholderId(
    tx: Prisma.TransactionClient,
    role: ProvisionableRole,
  ): Promise<string> {
    const prefix = STAKEHOLDER_ID_PREFIX[role];
    const pattern = '^' + prefix + '[0-9]+$';
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('m3_stakeholder_id'))`;
    const last = (await tx.$queryRaw<Array<{ code: string }>>`
      SELECT "stakeholderCode" AS code FROM "User"
      WHERE "stakeholderCode" ~ ${pattern}
      ORDER BY "stakeholderCode" DESC LIMIT 1`) as Array<{ code: string }>;
    const seq = last[0] ? parseInt(last[0].code.slice(prefix.length), 10) + 1 : 1;
    if (!Number.isFinite(seq)) throw new ConflictException('Unable to allocate a unique ID');
    return formatStakeholderId(prefix, seq);
  }

  async requireWorkerMalariaStatus(workerId: string): Promise<MalariaStatus> {
    const episodes = await this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: { diagnostics: true },
    });
    const results = episodes.flatMap((e) =>
      e.diagnostics.map((d) => ({ result: d.result as DiagnosticResultValue, testDate: d.testDate.toISOString() })),
    );
    const pending = episodes.some((e) => e.status !== 'RESOLVED' && e.diagnostics.length === 0);
    return deriveMalariaStatus(results, pending);
  }

  // ---- overview (spec §5) ----------------------------------------------------

  async overview() {
    const [
      totalSites,
      activeSites,
      totalContractors,
      totalWorkers,
      screeningComplete,
      pendingJoin,
      pendingTransfers,
      upcomingPositiveTravel,
      unacknowledgedTravelReports,
    ] = await Promise.all([
      this.prisma.constructionSite.count(),
      this.prisma.constructionSite.count({ where: { active: true } }),
      this.prisma.contractor.count(),
      this.prisma.worker.count(),
      this.prisma.initialScreening.count({ where: { status: 'COMPLETE' } }),
      this.prisma.siteJoinRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.siteTransferRequest.count({ where: { status: { notIn: TRANSFER_TERMINAL_STATUSES } } }),
      this._upcomingPositiveTravelCount(),
      this.prisma.travelReport.count({ where: { status: 'OPEN' } }),
    ]);

    // Malaria-status categories derive ONLY from authorised diagnostics:
    // positive / negative / awaiting / no result stay strictly separate.
    const episodes = await this.prisma.malariaEpisode.findMany({ include: { diagnostics: true } });
    const byWorker = new Map<string, DiagnosticResultValue[]>();
    const pendingWorker = new Set<string>();
    for (const ep of episodes) {
      for (const d of ep.diagnostics) {
        const list = byWorker.get(ep.workerId) ?? [];
        list.push(d.result as DiagnosticResultValue);
        byWorker.set(ep.workerId, list);
      }
      if (ep.status !== 'RESOLVED' && ep.diagnostics.length === 0) {
        pendingWorker.add(ep.workerId);
      }
    }
    const statusOf = (workerId: string): MalariaStatus =>
      deriveMalariaStatus(
        (byWorker.get(workerId) ?? []).map((result) => ({ result, testDate: new Date(0).toISOString() })),
        pendingWorker.has(workerId),
      );

    const workerIds = await this.prisma.worker.findMany({ select: { id: true } });
    const counts: Record<MalariaStatus, number> = { POSITIVE: 0, NEGATIVE: 0, AWAITING: 0, NO_RESULT: 0 };
    for (const w of workerIds) counts[statusOf(w.id)] += 1;

    return {
      sites: { total: totalSites, active: activeSites, inactive: totalSites - activeSites },
      contractors: { total: totalContractors },
      workers: {
        total: totalWorkers,
        screeningComplete,
        screeningIncomplete: totalWorkers - screeningComplete,
      },
      malaria: counts,
      requests: { pendingJoin, pendingTransfers },
      travel: {
        upcomingPositiveTravelReports: upcomingPositiveTravel,
        unacknowledgedTravelReports: unacknowledgedTravelReports,
      },
    };
  }

  private async _upcomingPositiveTravelCount(): Promise<number> {
    const soon = await this.prisma.travelRecord.findMany({
      where: {
        planningTravel: true,
        status: { not: 'CANCELLED' },
        departureDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
      },
      select: { workerId: true },
    });
    let n = 0;
    const seen = new Set<string>();
    for (const t of soon) {
      if (seen.has(t.workerId)) continue;
      if ((await this.requireWorkerMalariaStatus(t.workerId)) === 'POSITIVE') {
        n += 1;
        seen.add(t.workerId);
      }
    }
    return n;
  }

  // ---- construction sites (spec §6) -------------------------------------------

  async listSites(opts: { search?: string; status?: string; page?: string; pageSize?: string }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.ConstructionSiteWhereInput = {
      ...(opts.status === 'active' ? { active: true } : opts.status === 'inactive' ? { active: false } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' } },
              { siteCode: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.constructionSite.findMany({
        where,
        include: {
          area: { include: { parent: { include: { parent: true } } } },
          contractor: true,
          _count: { select: { assignments: { where: { active: true } } } },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.constructionSite.count({ where }),
    ]);
    return paginated(
      rows.map((s) => ({
        siteId: s.siteCode,
        name: s.name,
        district: s.area.parent?.parent?.name ?? null,
        taluka: s.area.parent?.name ?? null,
        area: s.area.name,
        address: s.address,
        contractor: s.contractor ? { contractorId: s.contractor.id, name: s.contractor.name } : null,
        activeWorkers: s._count.assignments,
        active: s.active,
      })),
      total,
      params,
    );
  }

  async createSite(actorId: string, input: CreateAdminSiteInput) {
    const siteCode = await this.uniqueSiteCode();
    const site = await this.prisma.constructionSite.create({
      data: {
        siteCode,
        name: input.name,
        areaId: input.areaId,
        contractorId: input.contractorId ?? null,
        address: input.address ?? null,
        landmark: input.landmark ?? null,
        contactPhone: input.contactPhone || null,
        active: true,
      },
      include: { area: true, contractor: true },
    });
    await this.audit.record({
      actorId,
      action: 'SITE_CREATED',
      entityType: 'ConstructionSite',
      entityId: site.id,
      metadata: { siteCode, name: site.name },
    });
    if (site.contractorId) {
      await this.prisma.contractorSite.upsert({
        where: { contractorId_siteId: { contractorId: site.contractorId, siteId: site.id } },
        create: { contractorId: site.contractorId, siteId: site.id, active: true },
        update: { active: true },
      });
      await this.audit.record({
        actorId,
        action: 'CONTRACTOR_ASSIGNED_TO_SITE',
        entityType: 'ConstructionSite',
        entityId: site.id,
        metadata: { contractorId: site.contractorId, siteCode },
      });
    }
    return this.siteDetail(site.siteCode);
  }

  async siteDetail(siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: {
        area: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
        contractor: true,
        contractorSites: {
          where: { active: true },
          include: {
            contractor: {
              include: { user: { select: { stakeholderCode: true, phone: true } } },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          include: { worker: { select: { workerCode: true, name: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
        },
        assignments: {
          where: { active: true },
          include: {
            worker: { select: { workerCode: true, name: true, phone: true } },
            contractor: { select: { id: true, name: true } },
          },
          orderBy: { startedAt: 'desc' },
        },
        _count: { select: { assignments: true, transfersFrom: true, transfersTo: true } },
      },
    });
    if (!site) throw new NotFoundException('Site not found');
    const workers = site.assignments.map((a) => ({
      workerId: a.worker.workerCode,
      name: a.worker.name,
      phone: a.worker.phone,
      contractorName: a.contractor?.name ?? site.contractor?.name ?? 'Unassigned',
      contractorId: a.contractor?.id ?? site.contractorId ?? null,
      since: a.startedAt.toISOString(),
    }));
    return {
      siteId: site.siteCode,
      name: site.name,
      active: site.active,
      address: site.address,
      landmark: site.landmark,
      contactPhone: site.contactPhone,
      area: site.area.name,
      taluka: site.area.parent?.name ?? null,
      district: site.area.parent?.parent?.name ?? null,
      state: site.area.parent?.parent?.parent?.name ?? null,
      areaId: site.areaId,
      contractor: site.contractor ? { contractorId: site.contractor.id, name: site.contractor.name } : null,
      assignedContractors: site.contractorSites.map((cs) => ({
        id: cs.id,
        contractorId: cs.contractorId,
        name: cs.contractor.name,
        stakeholderCode: cs.contractor.user?.stakeholderCode ?? null,
        phone: cs.contractor.user?.phone ?? null,
        assignedAt: cs.assignedAt.toISOString(),
      })),
      linkedWorkers: workers,
      pendingJoinRequests: site.joinRequests.map((r) => ({
        joinRequestId: r.id,
        workerId: r.worker.workerCode,
        workerName: r.worker.name,
        createdAt: r.createdAt.toISOString(),
      })),
      totals: {
        assignments: site._count.assignments,
        transfersFrom: site._count.transfersFrom,
        transfersTo: site._count.transfersTo,
      },
    };
  }

  async updateSite(actorId: string, siteCode: string, input: UpdateAdminSiteInput) {
    const site = await this.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site) throw new NotFoundException('Site not found');
    if (input.areaId) {
      const area = await this.prisma.locationNode.findUnique({ where: { id: input.areaId } });
      if (!area) throw new NotFoundException('Area not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.contractorId !== undefined && input.contractorId !== site.contractorId) {
        if (input.contractorId !== null) {
          const contractor = await tx.contractor.findUnique({ where: { id: input.contractorId } });
          if (!contractor) throw new NotFoundException('Contractor not found');
        }
      }
      await tx.constructionSite.update({
        where: { siteCode },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
          ...(input.address !== undefined ? { address: input.address ?? null } : {}),
          ...(input.landmark !== undefined ? { landmark: input.landmark ?? null } : {}),
          ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
          ...(input.contractorId !== undefined
            ? { contractorId: input.contractorId ?? null }
            : {}),
        },
      });
      await this.audit.record({
        actorId,
        action: 'SITE_UPDATED',
        entityType: 'ConstructionSite',
        entityId: site.id,
        metadata: { siteCode, changes: input },
        tx,
      });
      if (input.contractorId !== undefined && input.contractorId !== site.contractorId) {
        await this.audit.record({
          actorId,
          action: 'CONTRACTOR_ASSIGNED_TO_SITE',
          entityType: 'ConstructionSite',
          entityId: site.id,
          metadata: { siteCode, contractorId: input.contractorId },
          tx,
        });
        await this.notifyContractorAssignment(tx, siteCode, input.contractorId);
      }
    });
    return this.siteDetail(siteCode);
  }

  private async notifyContractorAssignment(
    tx: Prisma.TransactionClient,
    siteCode: string,
    contractorId: string | null,
  ): Promise<void> {
    await this.notify.notify({
      audienceRoles: ['ADMIN'] as PrismaRole[],
      type: 'SITE_CONTRACTOR_ASSIGNED',
      title: 'Contractor assignment updated',
      body: `Site ${siteCode} contractor assignment changed (${contractorId ? 'assigned' : 'unassigned'}).`,
      entityType: 'ConstructionSite',
      entityId: siteCode,
      dedupeKey: `site_contractor:${siteCode}:${contractorId ?? 'none'}`,
      tx,
    });
  }

  /**
   * Deactivation (spec §6.4): permanent deletion is never offered. The first
   * attempt without confirmation fails when active relationships exist, and
   * the admin UI shows the warning before resubmitting `confirm: true`.
   */
  async deactivateSite(
    actorId: string,
    siteCode: string,
    confirm: boolean | undefined,
  ) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: { contractor: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    if (!site.active) throw new BadRequestException('Site is already deactivated');

    const [activeWorkers, openTransfers, openJoinRequests] = await Promise.all([
      this.prisma.workerSiteAssignment.count({ where: { siteId: site.id, active: true } }),
      this.prisma.siteTransferRequest.count({
        where: {
          status: { notIn: TRANSFER_TERMINAL_STATUSES },
          OR: [{ fromSiteId: site.id }, { toSiteId: site.id }],
        },
      }),
      this.prisma.siteJoinRequest.count({ where: { siteId: site.id, status: 'PENDING' } }),
    ]);
    if (!confirm && (activeWorkers > 0 || site.contractorId || openTransfers > 0 || openJoinRequests > 0)) {
      throw new ConflictException(
        `Cannot deactivate without confirmation: ${activeWorkers} linked worker(s), ` +
          `${site.contractorId ? 'an assigned contractor, ' : ''}` +
          `${openTransfers} open transfer(s) and ${openJoinRequests} pending join request(s). ` +
          'Please confirm after reviewing the warning.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.constructionSite.update({ where: { siteCode }, data: { active: false } });
      await this.audit.record({
        actorId,
        action: 'SITE_DEACTIVATED',
        entityType: 'ConstructionSite',
        entityId: site.id,
        metadata: { siteCode, activeWorkers, openTransfers, openJoinRequests },
        tx,
      });
    });
    return this.siteDetail(siteCode);
  }

  // ---- Multiple Contractor Site Management (Spec §3, §8) -----------------------

  /** View all Contractors assigned to a site, including their active worker counts. */
  async getSiteContractors(siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: {
        contractor: {
          include: {
            user: { select: { stakeholderCode: true, phone: true } },
          },
        },
        contractorSites: {
          where: { active: true },
          include: {
            contractor: {
              include: {
                user: { select: { stakeholderCode: true, phone: true } },
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });
    if (!site) throw new NotFoundException('Site not found');

    const contractorMap = new Map<string, any>();
    if (site.contractor && site.contractorId) {
      contractorMap.set(site.contractorId, {
        id: `primary-${site.contractorId}`,
        contractorId: site.contractorId,
        name: site.contractor.name,
        stakeholderCode: site.contractor.user?.stakeholderCode ?? null,
        phone: site.contractor.user?.phone ?? null,
        assignedAt: site.createdAt.toISOString(),
      });
    }
    for (const cs of site.contractorSites) {
      contractorMap.set(cs.contractorId, {
        id: cs.id,
        contractorId: cs.contractorId,
        name: cs.contractor.name,
        stakeholderCode: cs.contractor.user?.stakeholderCode ?? null,
        phone: cs.contractor.user?.phone ?? null,
        assignedAt: cs.assignedAt.toISOString(),
      });
    }

    const result = await Promise.all(
      Array.from(contractorMap.values()).map(async (c) => {
        const activeWorkersCount = await this.prisma.workerSiteAssignment.count({
          where: {
            siteId: site.id,
            active: true,
            OR: [
              { contractorId: c.contractorId },
              { contractorId: null, site: { contractorId: c.contractorId } },
            ],
          },
        });
        return {
          ...c,
          activeWorkers: activeWorkersCount,
        };
      }),
    );

    return { items: result, total: result.length };
  }

  /** Add a Contractor to a construction site (multi-contractor model). */
  async addContractorToSite(actorId: string, siteCode: string, contractorId: string) {
    const [site, contractor] = await Promise.all([
      this.prisma.constructionSite.findUnique({ where: { siteCode } }),
      this.prisma.contractor.findUnique({ where: { id: contractorId } }),
    ]);
    if (!site) throw new NotFoundException('Site not found');
    if (!contractor) throw new NotFoundException('Contractor not found');

    const existing = await this.prisma.contractorSite.findUnique({
      where: { contractorId_siteId: { contractorId, siteId: site.id } },
    });

    if (existing && existing.active) {
      throw new ConflictException('Contractor is already assigned to this site');
    }

    const result = await this.prisma.contractorSite.upsert({
      where: { contractorId_siteId: { contractorId, siteId: site.id } },
      create: { contractorId, siteId: site.id, active: true },
      update: { active: true, removedAt: null, assignedAt: new Date() },
    });

    // Also maintain legacy primary contractorId if currently empty
    if (!site.contractorId) {
      await this.prisma.constructionSite.update({
        where: { id: site.id },
        data: { contractorId },
      });
    }

    await this.audit.record({
      actorId,
      action: 'SITE_CONTRACTOR_ADDED',
      entityType: 'ContractorSite',
      entityId: result.id,
      metadata: { siteCode, contractorId },
    });

    await this.notify.notify({
      audienceRoles: ['ADMIN'],
      type: 'SITE_CONTRACTOR_ASSIGNED',
      title: 'Contractor added to site',
      body: `Contractor ${contractor.name} was added to construction site ${site.name}.`,
      entityType: 'ConstructionSite',
      entityId: site.siteCode,
      dedupeKey: `site_contractor_add:${site.siteCode}:${contractorId}`,
    });

    return result;
  }

  /** Remove a Contractor from a site safely. Guards active workers with mandatory reassignment. */
  async removeContractorFromSite(
    actorId: string,
    siteCode: string,
    contractorId: string,
    reassignToContractorId?: string,
  ) {
    const site = await this.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site) throw new NotFoundException('Site not found');

    const cs = await this.prisma.contractorSite.findUnique({
      where: { contractorId_siteId: { contractorId, siteId: site.id } },
    });
    if (!cs || !cs.active) {
      throw new NotFoundException('Contractor is not actively assigned to this site');
    }

    // Check active workers managed by this contractor at this site
    const activeWorkers = await this.prisma.workerSiteAssignment.findMany({
      where: {
        siteId: site.id,
        active: true,
        OR: [
          { contractorId },
          { contractorId: null, site: { contractorId } },
        ],
      },
    });

    if (activeWorkers.length > 0 && !reassignToContractorId) {
      throw new ConflictException(
        `Cannot remove contractor: Contractor manages ${activeWorkers.length} active worker(s) at this site. You must specify a target contractor for reassignment.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      if (activeWorkers.length > 0 && reassignToContractorId) {
        if (reassignToContractorId === contractorId) {
          throw new BadRequestException('Target contractor for reassignment cannot be the same contractor being removed');
        }

        const targetCs = await tx.contractorSite.findUnique({
          where: { contractorId_siteId: { contractorId: reassignToContractorId, siteId: site.id } },
        });
        const isTargetActive = (targetCs && targetCs.active) || site.contractorId === reassignToContractorId;
        if (!isTargetActive) {
          throw new BadRequestException('Target contractor for reassignment is not active at this site');
        }

        // Reassign each active worker safely: close old assignment, create new assignment
        for (const wsa of activeWorkers) {
          await tx.workerSiteAssignment.update({
            where: { id: wsa.id },
            data: { active: false, status: 'ENDED', endedAt: now },
          });
          await tx.workerSiteAssignment.create({
            data: {
              workerId: wsa.workerId,
              siteId: site.id,
              contractorId: reassignToContractorId,
              active: true,
              status: 'ACTIVE',
              startedAt: now,
            },
          });
        }
      }

      // Mark ContractorSite as inactive
      await tx.contractorSite.update({
        where: { id: cs.id },
        data: { active: false, removedAt: now },
      });

      // If site.contractorId matches, point to another active contractor or null
      if (site.contractorId === contractorId) {
        const another = await tx.contractorSite.findFirst({
          where: { siteId: site.id, active: true, contractorId: { not: contractorId } },
        });
        await tx.constructionSite.update({
          where: { id: site.id },
          data: { contractorId: another?.contractorId ?? null },
        });
      }

      await this.audit.record({
        actorId,
        action: 'SITE_CONTRACTOR_REMOVED',
        entityType: 'ContractorSite',
        entityId: cs.id,
        metadata: { siteCode, contractorId, reassignedWorkers: activeWorkers.length, reassignToContractorId },
        tx,
      });

      return { removed: true, reassignedWorkers: activeWorkers.length };
    });
  }

  /** Complete assignment history for a construction site. */
  async getSiteAssignmentHistory(siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site) throw new NotFoundException('Site not found');

    const history = await this.prisma.workerSiteAssignment.findMany({
      where: { siteId: site.id },
      include: {
        worker: { select: { workerCode: true, name: true, phone: true } },
        contractor: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const items = history.map((h) => ({
      id: h.id,
      assignmentId: h.id,
      workerId: h.worker.workerCode,
      workerName: h.worker.name,
      phone: h.worker.phone,
      contractorId: h.contractor?.id ?? null,
      contractorName: h.contractor?.name ?? 'Unassigned / Primary',
      active: h.active,
      status: h.status,
      startedAt: h.startedAt.toISOString(),
      endedAt: h.endedAt?.toISOString() ?? null,
    }));

    return { items, total: items.length };
  }

  /** Full Location Tree for dependent cascading dropdowns: State -> District -> Taluka -> Village/Town */
  async locationTree() {
    const nodes = await this.prisma.locationNode.findMany({
      orderBy: { name: 'asc' },
    });
    return {
      state: nodes.find((n) => n.level === 'STATE') ?? { id: 'goa', name: 'Goa', level: 'STATE', parentId: null },
      districts: nodes.filter((n) => n.level === 'DISTRICT').map((n) => ({ id: n.id, name: n.name, parentId: n.parentId })),
      talukas: nodes.filter((n) => n.level === 'TALUKA').map((n) => ({ id: n.id, name: n.name, parentId: n.parentId })),
      areas: nodes.filter((n) => n.level === 'AREA').map((n) => ({ id: n.id, name: n.name, parentId: n.parentId })),
    };
  }

  /** Location-tree options for the create/edit forms (district → taluka → area). */
  async locationOptions() {
    const nodes = await this.prisma.locationNode.findMany({
      include: { parent: { include: { parent: { include: { parent: true } } } } },
      orderBy: { name: 'asc' },
    });
    return nodes
      .filter((n) => n.level === 'AREA')
      .map((n) => ({
        areaId: n.id,
        area: n.name,
        taluka: n.parent?.name ?? null,
        talukaId: n.parentId,
        district: n.parent?.parent?.name ?? null,
        districtId: n.parent?.parentId ?? null,
        state: n.parent?.parent?.parent?.name ?? null,
      }));
  }

  // ---- user management (spec §7) ------------------------------------------------

  async listUsers(opts: { search?: string; role?: string; page?: string; pageSize?: string }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.UserWhereInput = {
      role: { not: 'WORKER', ...(opts.role ? { equals: opts.role as PrismaRole } : {}) },
      ...(opts.search
        ? {
            OR: [
              { displayName: { contains: opts.search, mode: 'insensitive' } },
              { phone: { contains: opts.search } },
              { username: { contains: opts.search, mode: 'insensitive' } },
              { stakeholderCode: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { contractor: true },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(
      rows.map((u) => ({
        id: u.id,
        stakeholderId: u.stakeholderCode,
        name: u.displayName,
        phone: u.phone,
        username: u.username,
        role: u.role,
        active: u.active,
        mustChangeCredential: u.mustChangeCredential,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      params,
    );
  }

  async createUser(actorId: string, input: CreateAdminUserInput) {
    const phone = input.phone;
    const phoneTaken = await this.prisma.user.findFirst({ where: { phone } });
    const workerPhone = await this.prisma.worker.findUnique({ where: { phone } });
    if (phoneTaken || workerPhone) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const role = input.role;
    const tempPinHash = await bcrypt.hash(input.tempPin, BCRYPT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const stakeholderCode = await this.allocateStakeholderId(tx, role);

      let contractorId: string | null = null;
      if (role === 'CONTRACTOR') {
        const contractor = await tx.contractor.create({ data: { name: input.fullName } });
        contractorId = contractor.id;
      }

      const user = await tx.user.create({
        data: {
          role,
          displayName: input.fullName,
          phone,
          passwordHash: tempPinHash,
          stakeholderCode,
          mustChangeCredential: true,
          active: true,
          contractorId,
        },
      });

      if (contractorId && input.siteIds?.length) {
        for (const siteId of input.siteIds) {
          const site = await tx.constructionSite.findUnique({ where: { siteCode: siteId } });
          if (!site) throw new NotFoundException(`Site ${siteId} not found`);
          if (site.contractorId) {
            throw new ConflictException(
              `Site ${siteId} already has an assigned contractor; one site can have only one contractor`,
            );
          }
          await tx.constructionSite.update({
            where: { siteCode: siteId },
            data: { contractorId },
          });
          await this.audit.record({
            actorId,
            action: 'CONTRACTOR_ASSIGNED_TO_SITE',
            entityType: 'ConstructionSite',
            entityId: site.id,
            metadata: { siteCode: siteId, contractorId, userId: user.id },
            tx,
          });
        }
      }

      await this.audit.record({
        actorId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        metadata: { role, stakeholderCode, ...(contractorId ? { contractorId } : {}) },
        tx,
      });
      return { user, contractorId };
    });

    await this.notify.notify({
      audienceRoles: ['ADMIN'] as PrismaRole[],
      type: 'ACCOUNT_CREATED',
      title: 'Account created',
      body: `${role} account ${result.user.stakeholderCode} created for ${input.fullName}. First login requires the temporary PIN to be changed.`,
      entityType: 'User',
      entityId: result.user.id,
      dedupeKey: `user_created:${result.user.id}`,
    });

    return {
      id: result.user.id,
      stakeholderId: result.user.stakeholderCode,
      role,
      fullName: input.fullName,
      phone,
      mustChangeCredential: true,
      /** The temporary PIN itself is never returned or logged (spec §7/§8/§14). */
    };
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { contractor: { include: { sites: { include: { area: true }, orderBy: { name: 'asc' } } } } },
    });
    if (!user || user.role === 'WORKER') throw new NotFoundException('User not found');
    return {
      id: user.id,
      stakeholderId: user.stakeholderCode,
      name: user.displayName,
      phone: user.phone,
      username: user.username,
      role: user.role,
      active: user.active,
      mustChangeCredential: user.mustChangeCredential,
      createdAt: user.createdAt.toISOString(),
      contractor: user.contractor
        ? {
            contractorId: user.contractor.id,
            name: user.contractor.name,
            sites: user.contractor.sites.map((s) => ({
              siteId: s.siteCode,
              name: s.name,
              area: s.area.name,
              active: s.active,
            })),
          }
        : null,
    };
  }

  async setUserActive(actorId: string, id: string, active: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === 'WORKER') throw new NotFoundException('User not found');
    if (user.role === 'ADMIN' && !active) {
      throw new BadRequestException('The Admin account cannot be deactivated');
    }
    if (user.active !== active) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { active } });
        await this.audit.record({
          actorId,
          action: active ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
          entityType: 'User',
          entityId: id,
          metadata: { role: user.role },
          tx,
        });
      });
    }
    return this.userDetail(id);
  }

  /** Re-issues a fresh temporary PIN; the account is locked back into the first-login change flow. */
  async resetUserPin(actorId: string, id: string, input: ResetAdminUserPinInput) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === 'WORKER') throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(input.tempPin, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangeCredential: true },
      });
      await this.audit.record({
        actorId,
        action: 'USER_PIN_RESET',
        entityType: 'User',
        entityId: id,
        metadata: { role: user.role },
        tx,
      });
    });
    return this.userDetail(id);
  }

  // ---- worker management (spec §9) ------------------------------------------------

  async listWorkers(opts: {
    search?: string;
    siteCode?: string;
    screening?: string;
    malaria?: string;
    page?: string;
    pageSize?: string;
  }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.WorkerWhereInput = {
      ...(opts.siteCode ? { assignments: { some: { site: { siteCode: opts.siteCode }, active: true } } } : {}),
      ...(opts.screening === 'complete'
        ? { screening: { status: 'COMPLETE' } }
        : opts.screening === 'incomplete'
          ? { OR: [{ screening: { status: 'DRAFT' } }, { screening: { is: null } }] }
          : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' } },
              { workerCode: { contains: opts.search, mode: 'insensitive' } },
              { phone: { contains: opts.search } },
              { id: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        include: {
          user: { select: { active: true } },
          assignments: {
            where: { active: true },
            include: { site: true },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.worker.count({ where }),
    ]);

    const items = [];
    for (const w of rows) {
      const screening = await this.prisma.initialScreening.findUnique({ where: { workerId: w.id } });
      const malaria = await this.requireWorkerMalariaStatus(w.id);
      if (opts.malaria && malaria !== (opts.malaria as MalariaStatus)) continue;
      const assignment = w.assignments[0];
      items.push({
        workerId: w.workerCode,
        patientId: w.id,
        name: w.name,
        phone: w.phone,
        active: w.user?.active ?? true,
        createdAt: w.createdAt.toISOString(),
        site: assignment ? { siteId: assignment.site.siteCode, name: assignment.site.name } : null,
        screening: screening ? screening.status : 'NOT_STARTED',
        malaria,
      });
    }
    return paginated(items, total, params);
  }

  async workerDetail(workerCode: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { workerCode },
      include: {
        user: { select: { active: true } },
        assignments: {
          include: { site: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    const [screening, episodes, malaria] = await Promise.all([
      this.prisma.initialScreening.findUnique({ where: { workerId: worker.id } }),
      this.prisma.malariaEpisode.findMany({
        where: { workerId: worker.id },
        include: { diagnostics: { orderBy: { testDate: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.requireWorkerMalariaStatus(worker.id),
    ]);

    const activeAssignment = worker.assignments.find((a) => a.active) ?? null;

    return {
      workerId: worker.workerCode,
      patientId: worker.id,
      name: worker.name,
      phone: worker.phone,
      active: worker.user?.active ?? true,
      preferredLanguage: worker.preferredLanguage,
      createdAt: worker.createdAt.toISOString(),
      site: activeAssignment
        ? {
            siteId: activeAssignment.site.siteCode,
            name: activeAssignment.site.name,
            since: activeAssignment.startedAt.toISOString(),
          }
        : null,
      screening: screening
        ? {
            status: screening.status,
            completedAt: screening.completedAt?.toISOString() ?? null,
            consentGiven: screening.consentGiven,
          }
        : { status: 'NOT_STARTED', completedAt: null, consentGiven: false },
      malaria,
      episodes: episodes.map((e) => ({
        id: e.id,
        status: e.status,
        onsetDate: e.onsetDate?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
        diagnostics: e.diagnostics.map((d) => ({
          id: d.id,
          testType: d.testType,
          result: d.result,
          species: d.species,
          testDate: d.testDate.toISOString(),
        })),
      })),
      assignments: worker.assignments.map((a) => ({
        siteId: a.site.siteCode,
        siteName: a.site.name,
        active: a.active,
        startedAt: a.startedAt.toISOString(),
        endedAt: a.endedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Admin-only: safely remove / deactivate a worker from the active system.
   * Soft-deactivates the user, ends all active assignments, cancels pending transfers/join requests,
   * revokes active QR Pass tokens, records audit log, and preserves all surveillance & medical history.
   */
  async removeWorker(actorId: string, workerCode: string, input: { confirm: boolean; reason?: string }) {
    if (!input?.confirm) {
      throw new BadRequestException('Confirmation is required to remove a worker');
    }

    const worker = await this.prisma.worker.findUnique({
      where: { workerCode },
      include: { user: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Deactivate worker user account if exists (blocks login)
      if (worker.user) {
        await tx.user.update({
          where: { id: worker.user.id },
          data: { active: false },
        });
      }

      // 2. End all active site assignments
      await tx.workerSiteAssignment.updateMany({
        where: { workerId: worker.id, active: true },
        data: { active: false, status: 'ENDED', endedAt: now },
      });

      // 3. Cancel any pending transfers
      await tx.siteTransferRequest.updateMany({
        where: {
          workerId: worker.id,
          status: {
            in: [
              'PENDING_WORKER_RESPONSE',
              'PENDING_CURRENT_CONTRACTOR',
              'PENDING_DESTINATION_CONTRACTOR',
            ],
          },
        },
        data: { status: 'CANCELLED', cancelledById: actorId, cancelledAt: now },
      });

      // 4. Decline any pending join requests
      await tx.siteJoinRequest.updateMany({
        where: { workerId: worker.id, status: 'PENDING' },
        data: { status: 'DECLINED', decidedById: actorId, decidedAt: now },
      });

      // 5. Revoke any active worker pass tokens
      await tx.workerPassToken.updateMany({
        where: { workerId: worker.id, expiresAt: { gt: now }, revokedAt: null, usedAt: null },
        data: { revokedAt: now },
      });

      // 6. Record audit log (preserving audit history)
      await this.audit.record({
        actorId,
        action: 'WORKER_REMOVED',
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          workerCode,
          name: worker.name,
          phone: worker.phone,
          reason: input.reason ?? 'Deactivated by administrator',
        },
        tx,
      });
    });

    return this.workerDetail(workerCode);
  }

  /**
   * Admin-controlled correction process: allows authorised Admin to correct
   * worker registered full name or phone number with full audit logging.
   */
  async updateWorker(actorId: string, workerCode: string, dto: { name?: string; phone?: string }) {
    const worker = await this.prisma.worker.findUnique({
      where: { workerCode },
      include: { user: true },
    });
    if (!worker) throw new NotFoundException('Worker not found');

    const updateData: { name?: string; phone?: string } = {};
    if (dto.name && dto.name.trim()) updateData.name = dto.name.trim();
    if (dto.phone && dto.phone.trim()) updateData.phone = dto.phone.trim();

    if (Object.keys(updateData).length === 0) {
      return this.workerDetail(workerCode);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: worker.id },
        data: updateData,
      });

      if (worker.user) {
        await tx.user.update({
          where: { id: worker.user.id },
          data: {
            ...(updateData.name ? { displayName: updateData.name } : {}),
            ...(updateData.phone ? { phone: updateData.phone } : {}),
          },
        });
      }

      await this.audit.record({
        actorId,
        action: 'WORKER_DETAILS_CORRECTED',
        entityType: 'Worker',
        entityId: worker.id,
        metadata: {
          workerCode,
          old: { name: worker.name, phone: worker.phone },
          updated: updateData,
        },
        tx,
      });
    });

    return this.workerDetail(workerCode);
  }

  // ---- requests & transfers admin views (spec §10, §11) ----------------------------

  async listJoinRequests(opts: { status?: string; siteCode?: string; page?: string; pageSize?: string }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.SiteJoinRequestWhereInput = {
      ...(opts.status ? { status: opts.status as JoinRequestStatus } : {}),
      ...(opts.siteCode ? { site: { siteCode: opts.siteCode } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.siteJoinRequest.findMany({
        where,
        include: {
          worker: { select: { workerCode: true, name: true, phone: true } },
          site: { include: { contractor: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.siteJoinRequest.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({
        joinRequestId: r.id,
        workerId: r.worker.workerCode,
        workerName: r.worker.name,
        site: { siteId: r.site.siteCode, name: r.site.name },
        contractor: r.site.contractor ? { contractorId: r.site.contractor.id, name: r.site.contractor.name } : null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
      total,
      params,
    );
  }

  async listTransfers(opts: { status?: string; siteCode?: string; page?: string; pageSize?: string }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.SiteTransferRequestWhereInput = {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.siteCode
        ? { OR: [{ fromSite: { siteCode: opts.siteCode } }, { toSite: { siteCode: opts.siteCode } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.siteTransferRequest.findMany({
        where,
        include: {
          worker: { select: { workerCode: true, name: true } },
          fromSite: true,
          toSite: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.siteTransferRequest.count({ where }),
    ]);
    return paginated(
      rows.map((t) => ({
        transferId: t.id,
        workerId: t.worker.workerCode,
        workerName: t.worker.name,
        currentSite: t.fromSite ? { siteId: t.fromSite.siteCode, name: t.fromSite.name } : null,
        destinationSite: { siteId: t.toSite.siteCode, name: t.toSite.name },
        initiator: t.initiatorType,
        contractorApprovals: {
          from: t.fromContractorDecision,
          to: t.toContractorDecision,
        },
        workerAcceptance: t.workerDecision,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        effectiveAt: t.effectiveAt?.toISOString() ?? null,
      })),
      total,
      params,
    );
  }

  // ---- travel reports (spec §12) ----------------------------------------------------

  async listTravelReports(opts: {
    search?: string;
    status?: string;
    from?: string;
    to?: string;
    siteCode?: string;
    page?: string;
    pageSize?: string;
  }) {
    const params = parsePage(opts.page, opts.pageSize);

    let fromDate: Date | undefined;
    if (opts.from) {
      fromDate = new Date(opts.from);
      if (isNaN(fromDate.getTime())) throw new BadRequestException('Invalid from date format');
    }
    let toDate: Date | undefined;
    if (opts.to) {
      const slice = opts.to.length >= 10 ? opts.to.slice(0, 10) : opts.to;
      toDate = new Date(`${slice}T23:59:59.999Z`);
      if (isNaN(toDate.getTime())) throw new BadRequestException('Invalid to date format');
    }

    const where: Prisma.TravelReportWhereInput = {
      ...(opts.status ? { status: opts.status as TravelReportStatus } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(opts.siteCode
        ? {
            worker: {
              assignments: {
                some: { active: true, site: { siteCode: opts.siteCode } },
              },
            },
          }
        : {}),
      ...(opts.search
        ? {
            OR: [
              { worker: { name: { contains: opts.search, mode: 'insensitive' } } },
              { worker: { workerCode: { contains: opts.search, mode: 'insensitive' } } },
              { travelRecordId: { contains: opts.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.travelReport.findMany({
        where,
        include: {
          worker: { select: { workerCode: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.travelReport.count({ where }),
    ]);
    return paginated(
      rows.map((r) => ({
        id: r.id,
        workerId: r.worker.workerCode,
        workerName: r.worker.name,
        travelRecordId: r.travelRecordId,
        departureDate: r.departureDate?.toISOString() ?? null,
        destinationState: r.destinationState,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      params,
    );
  }

  async travelReportDetail(id: string) {
    const r = await this.prisma.travelReport.findUnique({
      where: { id },
      include: {
        worker: { select: { workerCode: true, name: true, phone: true } },
        travelRecord: true,
      },
    });
    if (!r) throw new NotFoundException('Travel report not found');

    const [submittedBy, reviewNotifications] = await Promise.all([
      this.prisma.user.findFirst({
        where: { contractorId: r.submittedByContractorId },
        select: { displayName: true, stakeholderCode: true },
      }),
      this.prisma.notification.findMany({
        where: { type: 'TRAVEL_RECORD_CANCELLED', entityType: 'TravelRecord', entityId: r.travelRecordId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      id: r.id,
      worker: { workerId: r.worker.workerCode, name: r.worker.name, phone: r.worker.phone },
      travelRecord: {
        id: r.travelRecord.id,
        status: r.travelRecord.status,
        planningTravel: r.travelRecord.planningTravel,
        departureDate: r.travelRecord.departureDate?.toISOString() ?? null,
        returnDate: r.travelRecord.returnDate?.toISOString() ?? null,
        destination: r.travelRecord.destination,
        state: r.travelRecord.state,
        createdAt: r.travelRecord.createdAt.toISOString(),
      },
      reason: r.reason,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      submittedBy: submittedBy
        ? { name: submittedBy.displayName, stakeholderId: submittedBy.stakeholderCode }
        : { name: `Contractor ${r.submittedByContractorId}`, stakeholderId: null },
      departureDate: r.departureDate?.toISOString() ?? null,
      destinationState: r.destinationState,
      createdAt: r.createdAt.toISOString(),
      cancellationNotifications: reviewNotifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async reviewTravelReport(actorId: string, id: string, input: TravelReportReviewInput) {
    const r = await this.prisma.travelReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Travel report not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.travelReport.update({
        where: { id },
        data: {
          status: input.status,
          reviewNote: input.note ?? null,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      await this.audit.record({
        actorId,
        action: 'TRAVEL_REPORT_REVIEWED',
        entityType: 'TravelReport',
        entityId: id,
        metadata: { status: input.status },
        tx,
      });
    });
    return this.travelReportDetail(id);
  }

  // ---- notifications (spec §13) -------------------------------------------------------

  async listNotifications(opts: { unreadOnly?: boolean; page?: string; pageSize?: string }) {
    const params = parsePage(opts.page, opts.pageSize);
    const where: Prisma.NotificationWhereInput = {
      audienceRole: 'ADMIN',
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { audienceRole: 'ADMIN', readAt: null } }),
    ]);
    return {
      ...paginated(
        rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          entityType: n.entityType,
          entityId: n.entityId,
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        })),
        total,
        params,
      ),
      unread,
    };
  }

  async ackNotification(actorId: string, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.audienceRole !== 'ADMIN') throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { id, acknowledged: true };
  }

  // ---- demonstration data management (spec §5, §8) ----------------------------

  private readonly DEMO_CONTRACTOR_PHONE = '9800000001';
  private readonly DEMO_SITE_CODE = 'SITE-DEMO01';
  private readonly DEMO_WORKER_PHONES = [
    '9800000011',
    '9800000012',
    '9800000013',
    '9800000014',
    '9800000015',
    '9800000016',
    '9800000017',
    '9800000018',
    '9800000019',
    '9800000020',
  ];

  async getDemoData() {
    const contractorUser = await this.prisma.user.findFirst({
      where: { phone: this.DEMO_CONTRACTOR_PHONE, role: 'CONTRACTOR' },
      include: { contractor: true },
    });

    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode: this.DEMO_SITE_CODE },
      include: {
        area: { include: { parent: { include: { parent: { include: { parent: true } } } } } },
        contractor: true,
      },
    });

    const workers = await this.prisma.worker.findMany({
      where: { phone: { in: this.DEMO_WORKER_PHONES } },
      include: {
        screening: true,
        episodes: { include: { diagnostics: true } },
        assignments: { where: { active: true }, include: { site: true } },
        travelRecords: { where: { status: { not: 'CANCELLED' } } },
      },
      orderBy: { phone: 'asc' },
    });

    return {
      contractor: contractorUser
        ? {
            id: contractorUser.contractorId,
            stakeholderCode: contractorUser.stakeholderCode,
            name: contractorUser.displayName,
            phone: contractorUser.phone,
            mustChangeCredential: contractorUser.mustChangeCredential,
            temporaryPinNotice: '1234',
          }
        : null,
      site: site
        ? {
            siteCode: site.siteCode,
            name: site.name,
            state: site.area.parent?.parent?.parent?.name ?? 'Goa',
            district: site.area.parent?.parent?.name ?? 'Kushavati',
            taluka: site.area.parent?.name ?? 'Quepem',
            area: site.area.name,
            address: site.address,
            landmark: site.landmark,
            contactPhone: site.contactPhone,
            active: site.active,
            assignedContractorName: site.contractor?.name ?? null,
          }
        : null,
      workers: workers.map((w) => {
        const diagnostics = w.episodes.flatMap((e) => e.diagnostics);
        const lastDiag = diagnostics[diagnostics.length - 1] ?? null;
        const decisive = diagnostics.find((d) => d.result === 'POSITIVE' || d.result === 'NEGATIVE');
        const status: MalariaStatus = decisive ? (decisive.result as MalariaStatus) : 'NO_RESULT';
        return {
          workerCode: w.workerCode,
          name: w.name,
          phone: w.phone,
          pinNotice: '1234',
          screeningStatus: w.screening?.status ?? 'INCOMPLETE',
          malariaStatus: status,
          diagnostic: lastDiag
            ? {
                testType: lastDiag.testType,
                result: lastDiag.result,
                species: lastDiag.species,
                testDate: lastDiag.testDate.toISOString(),
              }
            : null,
          hasUpcomingTravel: w.travelRecords.length > 0,
        };
      }),
    };
  }

  async resetDemoData(actorId: string) {
    const defaultPinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
    const targetPhones = [
      this.DEMO_CONTRACTOR_PHONE,
      '9800000002',
      '9800000003',
      '9800000004',
      '9800000005',
      ...this.DEMO_WORKER_PHONES,
    ];

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete prior demo workers cleanly
      const demoWorkers = await tx.worker.findMany({
        where: { phone: { in: targetPhones } },
        include: { episodes: true },
      });
      for (const dw of demoWorkers) {
        await tx.travelReport.deleteMany({ where: { workerId: dw.id } });
        await tx.travelRecord.deleteMany({ where: { workerId: dw.id } });
        await tx.siteJoinRequest.deleteMany({ where: { workerId: dw.id } });
        await tx.siteTransferRequest.deleteMany({ where: { workerId: dw.id } });
        await tx.workerSiteAssignment.deleteMany({ where: { workerId: dw.id } });
        await tx.prescription.deleteMany({ where: { workerId: dw.id } });
        for (const ep of dw.episodes) {
          await tx.diagnosticResult.deleteMany({ where: { episodeId: ep.id } });
        }
        await tx.malariaEpisode.deleteMany({ where: { workerId: dw.id } });
        await tx.symptomReport.deleteMany({ where: { workerId: dw.id } });
        await tx.followUp.deleteMany({ where: { workerId: dw.id } });
        await tx.initialScreening.deleteMany({ where: { workerId: dw.id } });
        await tx.user.deleteMany({ where: { phone: dw.phone } });
        await tx.worker.delete({ where: { id: dw.id } });
      }

      // 2. Delete prior demo site
      const existingSite = await tx.constructionSite.findUnique({ where: { siteCode: this.DEMO_SITE_CODE } });
      if (existingSite) {
        await tx.siteJoinRequest.deleteMany({ where: { siteId: existingSite.id } });
        await tx.siteTransferRequest.deleteMany({ where: { OR: [{ fromSiteId: existingSite.id }, { toSiteId: existingSite.id }] } });
        await tx.workerSiteAssignment.deleteMany({ where: { siteId: existingSite.id } });
        await tx.constructionSite.delete({ where: { id: existingSite.id } });
      }

      // 3. Delete prior demo contractor
      const existingContractorUser = await tx.user.findFirst({
        where: { phone: this.DEMO_CONTRACTOR_PHONE },
      });
      if (existingContractorUser) {
        await tx.user.delete({ where: { id: existingContractorUser.id } });
        if (existingContractorUser.contractorId) {
          await tx.contractor.delete({ where: { id: existingContractorUser.contractorId } }).catch(() => {});
        }
      }

      // 4. Recreate Demo Contractor
      const contractor = await tx.contractor.create({
        data: { name: 'Vikram Dempo (Demo Contractor)' },
      });
      const stakeholderCode = 'C000001';
      const userWithCode = await tx.user.findUnique({ where: { stakeholderCode } });
      const finalCode = userWithCode ? await this.allocateStakeholderId(tx, 'CONTRACTOR') : stakeholderCode;

      await tx.user.create({
        data: {
          role: 'CONTRACTOR',
          displayName: 'Vikram Dempo',
          phone: this.DEMO_CONTRACTOR_PHONE,
          passwordHash: defaultPinHash,
          stakeholderCode: finalCode,
          mustChangeCredential: true,
          active: true,
          contractorId: contractor.id,
        },
      });

      // 5. Recreate Demo Site in Goa -> Kushavati -> Quepem -> Curchorem
      let area = await tx.locationNode.findFirst({ where: { level: 'AREA', name: 'Curchorem' } });
      if (!area) {
        area = await tx.locationNode.findFirst({ where: { level: 'AREA' } });
      }
      if (!area) throw new NotFoundException('No Goa location nodes found. Please run seed first.');

      const demoSite = await tx.constructionSite.create({
        data: {
          siteCode: this.DEMO_SITE_CODE,
          name: 'DEMO Zuari Greens Housing Project',
          areaId: area.id,
          contractorId: contractor.id,
          address: 'Survey No. 84/2, Quepem-Curchorem Road',
          landmark: 'Opposite Old Government Primary School',
          contactPhone: '9800000002',
          active: true,
        },
      });

      // 6. Create 10 Synthetic Workers: 5 Negative, 5 Positive
      const workerDefs: Array<{
        phone: string;
        name: string;
        positive: boolean;
        testType: TestType;
        result: DiagnosticResultValue;
        species: PlasmodiumSpecies | null;
        travel?: boolean;
      }> = [
        { phone: '9800000011', name: 'Ramesh Kumar', positive: false, testType: 'RDT', result: 'NEGATIVE', species: null },
        { phone: '9800000012', name: 'Suresh Patil', positive: false, testType: 'MICROSCOPY', result: 'NEGATIVE', species: null },
        { phone: '9800000013', name: 'Manoj Sharma', positive: false, testType: 'RDT', result: 'NEGATIVE', species: null },
        { phone: '9800000014', name: 'Rajesh Verma', positive: false, testType: 'MICROSCOPY', result: 'NEGATIVE', species: null },
        { phone: '9800000015', name: 'Amit Singh', positive: false, testType: 'RDT', result: 'NEGATIVE', species: null },
        { phone: '9800000016', name: 'Vikas Yadav', positive: true, testType: 'RDT', result: 'POSITIVE', species: 'P_VIVAX', travel: true },
        { phone: '9800000017', name: 'Sunil Das', positive: true, testType: 'MICROSCOPY', result: 'POSITIVE', species: 'P_FALCIPARUM' },
        { phone: '9800000018', name: 'Anil Mondal', positive: true, testType: 'RDT', result: 'POSITIVE', species: 'P_VIVAX' },
        { phone: '9800000019', name: 'Deepak Roy', positive: true, testType: 'MICROSCOPY', result: 'POSITIVE', species: 'P_FALCIPARUM' },
        { phone: '9800000020', name: 'Sanjay Gupta', positive: true, testType: 'RDT', result: 'POSITIVE', species: 'MIXED' },
      ];

      for (let i = 0; i < workerDefs.length; i++) {
        const def = workerDefs[i]!;
        const workerCode = `M3-D${(i + 1).toString().padStart(2, '0')}`;
        const w = await tx.worker.create({
          data: {
            workerCode,
            name: def.name,
            phone: def.phone,
            preferredLanguage: 'en',
            user: {
              create: {
                role: 'WORKER',
                displayName: def.name,
                phone: def.phone,
                pinHash: defaultPinHash,
              },
            },
          },
        });

        // Site assignment
        await tx.workerSiteAssignment.create({
          data: { workerId: w.id, siteId: demoSite.id, active: true },
        });

        // Initial Screening
        await tx.initialScreening.create({
          data: {
            workerId: w.id,
            version: '2026.1',
            status: 'COMPLETE',
            consentGiven: true,
            answers: {
              full_name: def.name,
              gender: 'male',
              mobile_number: def.phone,
              fever_today: def.positive ? 'yes' : 'no',
            },
          },
        });

        // Malaria Episode & Authorized Diagnostic
        const episode = await tx.malariaEpisode.create({
          data: {
            workerId: w.id,
            status: def.positive ? 'CONFIRMED' : 'RESOLVED',
            onsetDate: new Date(),
          },
        });

        await tx.diagnosticResult.create({
          data: {
            episodeId: episode.id,
            testType: def.testType,
            result: def.result as PrismaDiagnosticResultValue,
            species: def.species,
            testDate: new Date(),
            createdById: actorId,
          },
        });

        // Worker 6: Upcoming travel to Bihar in 3 days (triggers 7-day travel alert)
        if (def.travel) {
          await tx.travelRecord.create({
            data: {
              workerId: w.id,
              planningTravel: true,
              state: 'Bihar',
              destination: 'Patna',
              departureDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
              returnDate: new Date(Date.now() + 18 * 24 * 3600 * 1000),
              status: 'PLANNED',
            },
          });
        }
      }

      await this.audit.record({
        actorId,
        action: 'DEMO_DATA_RESET',
        entityType: 'System',
        entityId: 'demo-dataset',
        metadata: { siteCode: this.DEMO_SITE_CODE, contractorCode: finalCode, workersCount: workerDefs.length },
        tx,
      });
    });

    return this.getDemoData();
  }

  // ---- Profile Demographic Corrections (Strict Allowlist) ------------------

  async listCorrections(filter?: { status?: string }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    return this.prisma.profileCorrectionRequest.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            displayName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewCorrection(
    adminUserId: string,
    correctionId: string,
    input: ReviewCorrectionInput,
  ) {
    const req = await this.prisma.profileCorrectionRequest.findUnique({
      where: { id: correctionId },
      include: { worker: { include: { user: true, screening: true } } },
    });
    if (!req) throw new NotFoundException('Correction request not found');
    if (req.status !== 'SUBMITTED') {
      throw new ConflictException(`Correction request is already ${req.status}`);
    }

    if (input.status === 'APPROVED') {
      const field = req.fieldName;
      const val = req.proposedValue;

      if (!ALLOWED_CORRECTION_FIELDS.includes(field as any)) {
        throw new BadRequestException(
          `Field "${field}" is not on the demographic correction allowlist.`,
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const workerUpdate: any = {};
        if (field === 'fullName') {
          workerUpdate.name = val;
          if (req.worker.user) {
            await tx.user.update({ where: { id: req.worker.user.id }, data: { displayName: val } });
          }
        } else if (field === 'phone') {
          workerUpdate.phone = val;
          if (req.worker.user) {
            await tx.user.update({ where: { id: req.worker.user.id }, data: { phone: val } });
          }
        }

        if (Object.keys(workerUpdate).length > 0) {
          await tx.worker.update({
            where: { id: req.workerId },
            data: workerUpdate,
          });
        }

        // Keep baseline screening answers synchronized
        const screening = await tx.initialScreening.findUnique({ where: { workerId: req.workerId } });
        if (screening) {
          const answers = { ...((screening.answers as Record<string, unknown>) || {}) };
          if (field === 'fullName') answers['full_name'] = val;
          if (field === 'phone') answers['mobile_number'] = val;
          if (field === 'dateOfBirth') answers['date_of_birth'] = val;
          if (field === 'gender') answers['gender'] = val;
          if (field === 'permanentAddressPincode') answers['permanent_address_pincode'] = val;
          if (field === 'permanentAddressDistrict') answers['permanent_address_district'] = val;
          if (field === 'permanentAddressState') answers['permanent_address_state'] = val;
          if (field === 'permanentAddressDetails') answers['permanent_address_details'] = val;
          await tx.initialScreening.update({
            where: { workerId: req.workerId },
            data: { answers: answers as Prisma.InputJsonValue },
          });
        }

        await tx.profileCorrectionRequest.update({
          where: { id: correctionId },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedById: adminUserId,
            adminNote: input.reviewNote ?? null,
          },
        });

        await this.audit.record({
          actorId: adminUserId,
          action: 'PROFILE_CORRECTION_APPROVED',
          entityType: 'ProfileCorrectionRequest',
          entityId: correctionId,
          metadata: {
            workerId: req.workerId,
            field,
            oldValue: req.currentValue,
            newValue: val,
          },
          tx,
        });
      });
    } else {
      await this.prisma.profileCorrectionRequest.update({
        where: { id: correctionId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedById: adminUserId,
          adminNote: input.reviewNote ?? null,
        },
      });

      await this.audit.record({
        actorId: adminUserId,
        action: 'PROFILE_CORRECTION_REJECTED',
        entityType: 'ProfileCorrectionRequest',
        entityId: correctionId,
        metadata: { workerId: req.workerId, field: req.fieldName, note: input.reviewNote },
      });
    }

    return this.prisma.profileCorrectionRequest.findUnique({
      where: { id: correctionId },
      include: { worker: true, reviewedBy: true },
    });
  }
}
