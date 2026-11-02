import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role as PrismaRole } from '@prisma/client';
import type { SubmitTravelReportInput } from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { AdminService } from '../admin/admin.service';

const TRAVEL_WINDOW_DAYS = 7;

@Injectable()
export class TravelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
    private readonly admin: AdminService,
  ) {}

  /** Sites currently under this contractor. */
  private contractorSites(contractorId: string) {
    return this.prisma.constructionSite.findMany({ where: { contractorId }, select: { id: true } });
  }

  /**
   * Travel records that must be reported: workers currently assigned to this
   * contractor's sites, POSITIVE malaria status (never NEGATIVE/AWAITING/
   * NO_RESULT), planning travel, departing within the seven-day window.
   */
  async alertsForContractor(contractorId: string) {
    const sites = await this.contractorSites(contractorId);
    if (sites.length === 0) return [];
    const now = new Date();
    const horizon = new Date(now.getTime() + TRAVEL_WINDOW_DAYS * 24 * 3600 * 1000);

    const assignments = await this.prisma.workerSiteAssignment.findMany({
      where: { active: true, siteId: { in: sites.map((s) => s.id) } },
      select: { workerId: true },
    });
    const workerIds = assignments.map((a) => a.workerId);
    if (workerIds.length === 0) return [];

    const records = await this.prisma.travelRecord.findMany({
      where: {
        workerId: { in: workerIds },
        planningTravel: true,
        status: { not: 'CANCELLED' },
        departureDate: { gte: now, lte: horizon },
      },
      include: { worker: { select: { workerCode: true, name: true, phone: true } } },
      orderBy: { departureDate: 'asc' },
    });

    const results = [];
    const seen = new Set<string>();
    for (const r of records) {
      const status = await this.admin.requireWorkerMalariaStatus(r.workerId);
      if (status !== 'POSITIVE') continue; // negative/awaiting/no-result never trigger
      const already = await this.prisma.travelReport.findUnique({ where: { travelRecordId: r.id } });
      if (already) continue; // one report per travel case
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      results.push({
        travelRecordId: r.id,
        workerId: r.worker.workerCode,
        workerName: r.worker.name,
        departureDate: r.departureDate?.toISOString() ?? null,
        destination: r.destination,
        state: r.state,
        requiresReport: true,
      });
    }
    return results;
  }

  /** Contractor submits the single mandatory report for a flagged travel case. */
  async submitReport(contractorId: string, userId: string, input: SubmitTravelReportInput) {
    if (!input.comment?.trim()) {
      throw new BadRequestException('A reason or comment is required');
    }
    const workerRef = input.workerId;
    const worker = await this.prisma.worker.findFirst({
      where: { OR: [{ workerCode: workerRef }, { id: workerRef }] },
    });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');

    // The report is filed against the contractor who manages the worker's site.
    const sites = await this.contractorSiteIds(contractorId);
    const assignment = await this.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker.id, active: true, siteId: { in: sites } },
    });
    if (!assignment) {
      throw new ForbiddenException('Only the site Contractor of this worker can submit the travel report');
    }

    const record = await this.prisma.travelRecord.findUnique({ where: { id: input.travelRecordId } });
    if (!record || record.workerId !== worker.id) {
      throw new NotFoundException('Travel record not found for this worker');
    }
    if (record.status === 'CANCELLED') {
      throw new BadRequestException('This travel record was cancelled; no report is required');
    }

    const malaria = await this.admin.requireWorkerMalariaStatus(worker.id);
    if (malaria !== 'POSITIVE') {
      throw new BadRequestException('Travel reports apply only to authorised POSITIVE malaria cases');
    }

    const existing = await this.prisma.travelReport.findUnique({ where: { travelRecordId: record.id } });
    if (existing) {
      throw new ConflictException('A report already exists for this travel case');
    }

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.travelReport.create({
        data: {
          travelRecordId: record.id,
          workerId: worker.id,
          departureDate: record.departureDate,
          destinationState: record.state,
          reason: input.comment.trim(),
          status: 'OPEN',
          submittedByContractorId: contractorId,
        },
      });
      await this.audit.record({
        actorId: userId,
        action: 'TRAVEL_REPORT_SUBMITTED',
        entityType: 'TravelReport',
        entityId: created.id,
        metadata: { travelRecordId: record.id, workerId: worker.id },
        tx,
      });
      await this.notify.notify({
        audienceRoles: ['ADMIN', 'CLINICIAN', 'RESEARCH_LAB'] as PrismaRole[],
        type: 'TRAVEL_REPORT_SUBMITTED',
        title: 'Positive-case travel report submitted',
        body: `A Contractor submitted a travel report for worker ${worker.workerCode} departing ${record.departureDate?.toISOString().slice(0, 10) ?? 'on the planned date'}.`,
        entityType: 'TravelReport',
        entityId: created.id,
        dedupeKey: `travel_report_submitted:${created.id}`,
        tx,
      });
      return created;
    });
    return { id: report.id, travelRecordId: report.travelRecordId, status: report.status };
  }

  private async contractorSiteIds(contractorId: string): Promise<string[]> {
    const sites = await this.contractorSites(contractorId);
    return sites.map((s) => s.id);
  }

  /**
   * Worker cancels a planned travel record. Any existing report is preserved
   * (never deleted); recipients are notified of the cancellation (spec §12).
   */
  async cancelTravelRecord(workerId: string, userId: string, travelRecordId: string, reason?: string) {
    const record = await this.prisma.travelRecord.findUnique({ where: { id: travelRecordId } });
    if (!record) throw new NotFoundException('Travel record not found');
    if (record.workerId !== workerId) throw new ForbiddenException('Not your travel record');
    if (record.status === 'CANCELLED') {
      throw new ConflictException('Travel record already cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.travelRecord.update({
        where: { id: travelRecordId },
        data: { status: 'CANCELLED', planningTravel: false },
      });
      await this.audit.record({
        actorId: userId,
        action: 'TRAVEL_RECORD_CANCELLED',
        entityType: 'TravelRecord',
        entityId: travelRecordId,
        metadata: { workerId, reason: reason ?? null },
        tx,
      });
      await this.notify.notify({
        audienceRoles: ['ADMIN', 'CLINICIAN', 'RESEARCH_LAB'] as PrismaRole[],
        type: 'TRAVEL_RECORD_CANCELLED',
        title: 'Reported worker cancelled travel',
        body: `Travel was cancelled for a worker with a submitted travel report.`,
        entityType: 'TravelRecord',
        entityId: travelRecordId,
        dedupeKey: `travel_cancelled:${travelRecordId}`,
        tx,
      });
    });

    const report = await this.prisma.travelReport.findUnique({ where: { travelRecordId } });
    return {
      travelRecordId,
      status: 'CANCELLED' as const,
      reportPreserved: Boolean(report),
    };
  }
}
