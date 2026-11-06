import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role as PrismaRole } from '@prisma/client';
import { TravelDirection, DepartureConfirmationStatus } from '@prisma/client';
import type {
  SubmitTravelReportInput,
  TravelLeaveInput,
  TravelEnterInput,
  ArrivalScreeningInput,
  ConfirmDepartureInput,
} from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { IdempotencyService } from '../common/idempotency.service';
import { AdminService } from '../admin/admin.service';

const TRAVEL_WINDOW_DAYS = 7;

@Injectable()
export class TravelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
    private readonly admin: AdminService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /** Sites currently under this contractor (direct or multi-contractor assignment). */
  private async contractorSites(contractorId: string) {
    const direct = await this.prisma.constructionSite.findMany({ where: { contractorId }, select: { id: true } });
    const multi = await this.prisma.contractorSite.findMany({ where: { contractorId, active: true }, select: { siteId: true } });
    const ids = Array.from(new Set([...direct.map((s) => s.id), ...multi.map((m) => m.siteId)]));
    return ids.map((id) => ({ id }));
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
    if (!input.workerId) {
      throw new BadRequestException('workerId is required for contractor travel report');
    }
    if (!input.travelRecordId) {
      throw new BadRequestException('travelRecordId is required for contractor travel report');
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

  /** Worker submits a travel report for planned or ongoing travel. */
  async submitWorkerReport(workerId: string, userId: string, input: SubmitTravelReportInput) {
    if (!input.comment?.trim()) {
      throw new BadRequestException('A reason or comment is required');
    }

    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    let recordId = input.travelRecordId;
    if (recordId) {
      const record = await this.prisma.travelRecord.findUnique({ where: { id: recordId } });
      if (!record || record.workerId !== worker.id) {
        throw new NotFoundException('Travel record not found for this worker');
      }
    } else {
      const newRecord = await this.prisma.travelRecord.create({
        data: {
          workerId: worker.id,
          planningTravel: true,
          status: 'SUBMITTED',
        },
      });
      recordId = newRecord.id;
    }

    const assignment = await this.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker.id, active: true },
      include: { site: true },
    });
    const contractorId = assignment?.site?.contractorId || 'WORKER_SELF_REPORT';

    const existing = await this.prisma.travelReport.findUnique({ where: { travelRecordId: recordId } });
    if (existing) {
      const updated = await this.prisma.travelReport.update({
        where: { id: existing.id },
        data: { reason: input.comment.trim() },
      });
      return { id: updated.id, travelRecordId: updated.travelRecordId, status: updated.status };
    }

    const report = await this.prisma.$transaction(async (tx) => {
      const created = await tx.travelReport.create({
        data: {
          travelRecordId: recordId,
          workerId: worker.id,
          reason: input.comment.trim(),
          status: 'OPEN',
          submittedByContractorId: contractorId,
        },
      });
      await this.audit.record({
        actorId: userId,
        action: 'TRAVEL_REPORT_SUBMITTED_BY_WORKER',
        entityType: 'TravelReport',
        entityId: created.id,
        metadata: { travelRecordId: recordId, workerId: worker.id },
        tx,
      });
      await this.notify.notify({
        audienceRoles: ['ADMIN', 'CLINICIAN', 'RESEARCH_LAB'] as PrismaRole[],
        type: 'TRAVEL_REPORT_SUBMITTED',
        title: 'Worker travel report submitted',
        body: `Worker ${worker.workerCode} (${worker.name}) submitted a travel report.`,
        entityType: 'TravelReport',
        entityId: created.id,
        dedupeKey: `travel_report_worker:${created.id}`,
        tx,
      });
      return created;
    });

    return { id: report.id, travelRecordId: report.travelRecordId, status: report.status };
  }

  async listRecordsForWorker(workerId: string) {
    return this.prisma.travelRecord.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      include: { reports: true },
    });
  }

  async listReports(opts: { workerId?: string; contractorId?: string }) {
    const where: any = {};
    if (opts.workerId) where.workerId = opts.workerId;
    if (opts.contractorId) where.submittedByContractorId = opts.contractorId;
    return this.prisma.travelReport.findMany({
      where,
      include: { travelRecord: true, worker: true },
      orderBy: { createdAt: 'desc' },
    });
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
        data: { status: 'CANCELLED', departureStatus: 'CANCELLED', planningTravel: false },
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
      departureStatus: 'CANCELLED' as const,
      cancelled: true,
      reportPreserved: Boolean(report),
    };
  }

  // ─── Worker Leaving Goa Workflow ──────────────────────────────────────────

  async recordLeavingGoa(workerId: string, userId: string, input: TravelLeaveInput) {
    if (input.idempotencyKey) {
      const prior = await this.idempotency.lookup('travel_leave', input.idempotencyKey);
      if (prior) {
        return this.prisma.travelRecord.findUnique({ where: { id: prior } });
      }
    }

    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Duplicate check: if a pending/active travel record already exists for the same departure date
    const existing = await this.prisma.travelRecord.findFirst({
      where: {
        workerId,
        departureDate: new Date(input.departureDate),
        status: { not: 'CANCELLED' },
        departureStatus: { not: DepartureConfirmationStatus.CANCELLED },
      },
    });
    if (existing) {
      return existing;
    }

    const destParts = [input.destinationTown, input.destinationDistrict, input.destinationState].filter(Boolean);
    const destinationStr = destParts.length > 0 ? destParts.join(', ') : input.destinationState;

    const record = await this.prisma.travelRecord.create({
      data: {
        workerId,
        direction: TravelDirection.LEAVING_GOA,
        departureStatus: DepartureConfirmationStatus.PENDING_CONFIRMATION,
        planningTravel: true,
        departureDate: new Date(input.departureDate),
        returnDate: input.expectedReturnDate
          ? new Date(input.expectedReturnDate)
          : input.returnDate
          ? new Date(input.returnDate)
          : null,
        purpose: input.purpose ?? null,
        state: input.destinationState,
        district: input.destinationDistrict ?? null,
        town: input.destinationTown ?? null,
        destination: destinationStr,
        status: 'SUBMITTED',
      },
    });

    if (input.idempotencyKey) {
      await this.idempotency.record('travel_leave', input.idempotencyKey, userId, record.id);
    }

    await this.notify.notify({
      audienceRoles: ['ADMIN'] as PrismaRole[],
      type: 'WORKER_LEAVING_GOA',
      title: 'Worker Departure Reported',
      body: `Worker ${worker.workerCode} reported departure to ${input.destinationState}. Pending departure confirmation.`,
      entityType: 'TravelRecord',
      entityId: record.id,
      dedupeKey: `leave_goa:${record.id}:admin`,
    });

    await this.audit.record({
      actorId: userId,
      action: 'TRAVEL_DEPARTURE_REPORTED',
      entityType: 'TravelRecord',
      entityId: record.id,
      metadata: { workerId, destinationState: input.destinationState },
    });

    return record;
  }

  // ─── Worker Entering Goa Workflow ─────────────────────────────────────────

  async recordEnteringGoa(workerId: string, userId: string, input: TravelEnterInput) {
    if (input.idempotencyKey) {
      const prior = await this.idempotency.lookup('travel_enter', input.idempotencyKey);
      if (prior) {
        return this.prisma.travelRecord.findUnique({ where: { id: prior } });
      }
    }

    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    // If travelRecordId provided, check if existing record can be updated
    let record;
    if (input.travelRecordId) {
      const existing = await this.prisma.travelRecord.findUnique({
        where: { id: input.travelRecordId },
      });
      if (existing && existing.workerId === workerId) {
        record = await this.prisma.travelRecord.update({
          where: { id: input.travelRecordId },
          data: {
            direction: TravelDirection.ENTERING_GOA,
            returnDate: new Date(input.arrivalDate),
            originState: input.originState ?? existing.originState,
            originDistrict: input.originDistrict ?? existing.originDistrict,
            originTown: input.originTown ?? existing.originTown,
            hadFeverOrMalaria: input.hadFeverOrMalaria,
            treatmentGiven: input.treatmentGiven,
            completedCourse: input.completedCourse,
            treatmentPlace: input.treatmentPlace ?? null,
            planningTravel: false,
          },
        });
      }
    }

    if (!record) {
      // Duplicate check: if an arrival record already exists for the same arrival date
      const existingArrival = await this.prisma.travelRecord.findFirst({
        where: {
          workerId,
          returnDate: new Date(input.arrivalDate),
          status: { not: 'CANCELLED' },
        },
      });
      if (existingArrival) {
        return existingArrival;
      }

      const originParts = [input.originTown, input.originDistrict, input.originState].filter(Boolean);
      const originStr = originParts.length > 0 ? originParts.join(', ') : input.originState ?? null;

      record = await this.prisma.travelRecord.create({
        data: {
          workerId,
          direction: TravelDirection.ENTERING_GOA,
          planningTravel: false,
          returnDate: new Date(input.arrivalDate),
          state: input.originState ?? null,
          originState: input.originState ?? null,
          originDistrict: input.originDistrict ?? null,
          originTown: input.originTown ?? null,
          destination: originStr,
          hadFeverOrMalaria: input.hadFeverOrMalaria,
          treatmentGiven: input.treatmentGiven,
          completedCourse: input.completedCourse,
          treatmentPlace: input.treatmentPlace ?? null,
          status: 'SUBMITTED',
        },
      });
    }

    if (input.idempotencyKey) {
      await this.idempotency.record('travel_enter', input.idempotencyKey, userId, record.id);
    }

    // If worker had fever/malaria during travel, immediately notify Admin and Clinicians
    if (input.hadFeverOrMalaria) {
      await this.notify.notify({
        audienceRoles: ['ADMIN', 'CLINICIAN'] as PrismaRole[],
        type: 'TRAVEL_FEVER_MALARIA_FLAG',
        title: 'Entering Worker Flagged with Fever/Malaria',
        body: `Worker ${worker.workerCode} reported fever or malaria during recent travel from ${input.originState || 'outside Goa'}.`,
        entityType: 'TravelRecord',
        entityId: record.id,
        dedupeKey: `enter_goa_fever:${record.id}`,
      });
    }

    await this.audit.record({
      actorId: userId,
      action: 'TRAVEL_ARRIVAL_REPORTED',
      entityType: 'TravelRecord',
      entityId: record.id,
      metadata: { workerId, hadFeverOrMalaria: input.hadFeverOrMalaria },
    });

    return record;
  }

  // ─── Admin Departure Confirmation ─────────────────────────────────────────

  async confirmDeparture(travelRecordId: string, adminUserId: string, input: ConfirmDepartureInput) {
    const record = await this.prisma.travelRecord.findUnique({
      where: { id: travelRecordId },
      include: { worker: true },
    });
    if (!record) throw new NotFoundException('Travel record not found');

    const updated = await this.prisma.travelRecord.update({
      where: { id: travelRecordId },
      data: {
        departureStatus: input.status as DepartureConfirmationStatus,
      },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'TRAVEL_DEPARTURE_CONFIRMED',
      entityType: 'TravelRecord',
      entityId: travelRecordId,
      metadata: { status: input.status, notes: input.notes },
    });

    return updated;
  }

  // ─── Health Worker Arrival Screening ──────────────────────────────────────

  async recordArrivalScreening(travelRecordId: string, healthWorkerUserId: string, input: ArrivalScreeningInput) {
    const record = await this.prisma.travelRecord.findUnique({
      where: { id: travelRecordId },
      include: { worker: true },
    });
    if (!record) throw new NotFoundException('Travel record not found');

    let facilityId = input.arrivalFacilityId;
    if (!facilityId) {
      const assignment = await this.prisma.facilityStaffAssignment.findFirst({
        where: { userId: healthWorkerUserId, active: true },
      });
      facilityId = assignment?.facilityId ?? null;
    }

    const facility = facilityId
      ? await this.prisma.facility.findUnique({ where: { id: facilityId } })
      : null;

    const arrivalFever = input.arrivalFever ?? (input as any).hadFever ?? null;
    const arrivalTestedOrTreated = input.arrivalTestedOrTreated ?? (input as any).testedOrTreated ?? null;
    const arrivalReferred = input.arrivalReferred ?? (input as any).referredForClinicalCare ?? null;

    // Update on existing travel record without creating duplicate rows
    const updated = await this.prisma.travelRecord.update({
      where: { id: travelRecordId },
      data: {
        arrivalFacilityId: facility?.id ?? null,
        arrivalFever,
        arrivalTestedOrTreated,
        arrivalReferred,
      },
    });

    // If arrival fever or referred, notify facility clinicians
    if (facility && (arrivalFever || arrivalReferred)) {
      await this.notify.notify({
        audienceFacilityIds: [facility.id],
        type: 'ARRIVAL_SCREENING_FLAG',
        title: 'Arrival Screening Clinical Flag',
        body: `Worker ${record.worker.workerCode} screened on arrival with fever/referral at ${facility.name}.`,
        entityType: 'TravelRecord',
        entityId: travelRecordId,
        dedupeKey: `arrival_flag:${travelRecordId}:${facility.id}`,
      });
    }

    await this.audit.record({
      actorId: healthWorkerUserId,
      action: 'ARRIVAL_SCREENING_COMPLETED',
      entityType: 'TravelRecord',
      entityId: travelRecordId,
      metadata: {
        arrivalFacilityId: facility?.id ?? null,
        arrivalFever,
        arrivalReferred,
      },
    });

    return {
      ...updated,
      arrivalScreened: true,
    };
  }
}
