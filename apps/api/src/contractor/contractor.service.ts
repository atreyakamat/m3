import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  /** Verifies that the contractor is assigned to the requested site code. */
  async validateContractorSite(contractorId: string, siteCode: string) {
    const site = await this.prisma.constructionSite.findUnique({
      where: { siteCode },
      include: { area: true },
    });
    if (!site) throw new NotFoundException(`Construction site ${siteCode} not found`);
    if (site.contractorId !== contractorId) {
      throw new ForbiddenException(`You are not assigned to construction site ${siteCode}`);
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
          },
        },
      },
    });
    if (!user || user.role !== 'CONTRACTOR' || !user.contractor) {
      throw new ForbiddenException('Not an active contractor account');
    }

    return {
      contractorId: user.stakeholderCode ?? user.contractorId ?? '',
      contractorCode: user.stakeholderCode ?? user.contractorId ?? '',
      name: user.displayName,
      phone: user.phone ?? '',
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      assignedSites: user.contractor.sites.map((s) => ({
        siteId: s.siteCode,
        siteCode: s.siteCode,
        name: s.name,
        area: s.area.name,
        activeWorkers: s._count.assignments,
      })),
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
      where: { siteId: site.id, active: true },
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
    if (activeAssignment.site.contractorId !== contractorId) {
      throw new ForbiddenException('Worker is not assigned to a site under your management');
    }

    const malaria = await this.admin.requireWorkerMalariaStatus(worker.id);
    const contractorMalariaStatus: 'POSITIVE' | 'NEGATIVE' | null =
      malaria === 'POSITIVE' || malaria === 'NEGATIVE' ? malaria : null;
    const demo = extractDemographics(worker.screening);

    return {
      workerId: worker.workerCode,
      patientId: worker.id,
      name: worker.name,
      phone: worker.phone,
      age: demo.age,
      gender: demo.gender,
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
}
