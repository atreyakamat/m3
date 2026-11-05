import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  DiagnosticResultInput,
  FollowUpResponseInput,
  SymptomReportInput,
  TravelRecordInput,
  CreateHouseholdAssessmentInput,
} from '@m3/shared';
import type { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { IdempotencyService } from '../common/idempotency.service';
import { NotificationService } from '../common/notification.service';
import { TranslationService } from '../common/translation.service';

function parseValidDate(val: string | undefined | null, fieldName: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date format for ${fieldName}`);
  }
  return d;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly notification: NotificationService,
    private readonly translation: TranslationService,
  ) {}

  // ---- worker reads -------------------------------------------------------

  listEpisodes(workerId: string) {
    return this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: {
        diagnostics: { orderBy: { testDate: 'desc' } },
        prescriptions: { orderBy: { issuedAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listDiagnostics(workerId: string) {
    const episodes = await this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: { diagnostics: { orderBy: { testDate: 'desc' } } },
    });
    return episodes.flatMap((e) =>
      e.diagnostics.map((d) => ({
        id: d.id,
        episodeId: e.id,
        testType: d.testType,
        result: d.result,
        species: d.species,
        testDate: d.testDate.toISOString(),
      })),
    );
  }

  async currentPrescription(workerId: string) {
    return this.prisma.prescription.findFirst({
      where: { workerId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  prescriptionHistory(workerId: string) {
    return this.prisma.prescription.findMany({
      where: { workerId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  listFollowUps(workerId: string) {
    return this.prisma.followUp.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listTravelRecords(workerId: string) {
    return this.prisma.travelRecord.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- worker writes ------------------------------------------------------

  async submitSymptomReport(workerId: string, userId: string, input: SymptomReportInput) {
    if (input.idempotencyKey) {
      const prior = await this.idempotency.lookup('symptom_report', input.idempotencyKey);
      if (prior) {
        return this.prisma.symptomReport.findUnique({ where: { id: prior } });
      }
    }
    const report = await this.prisma.symptomReport.create({
      data: {
        workerId,
        episodeId: input.episodeId ?? null,
        symptoms: (input.symptoms ?? []) as Prisma.InputJsonValue,
        note: input.note ?? null,
        voiceData: input.voiceData ?? null,
      },
    });
    if (input.idempotencyKey) {
      await this.idempotency.record('symptom_report', input.idempotencyKey, userId, report.id);
    }

    // Check if worker submitted a recent report within 2 hours for deduplication (Phase 8)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentReport = await this.prisma.symptomReport.findFirst({
      where: {
        workerId,
        createdAt: { gte: twoHoursAgo },
        id: { not: report.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentSymptoms: string[] = Array.isArray(input.symptoms) ? input.symptoms : [];
    let shouldNotify = true;

    if (recentReport) {
      const priorSymptoms: string[] = Array.isArray(recentReport.symptoms)
        ? (recentReport.symptoms as string[])
        : [];
      // Do not suppress if new or worsening symptoms are reported
      const hasNewSymptoms = currentSymptoms.some((s) => !priorSymptoms.includes(s));
      const hasMoreSymptoms = currentSymptoms.length > priorSymptoms.length;
      if (!hasNewSymptoms && !hasMoreSymptoms && !input.note) {
        shouldNotify = false;
      }
    }

    if (shouldNotify) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: workerId },
        select: { workerCode: true },
      });

      // Generic notification message (Phase 8: Do not expose cleartext clinical symptoms in notification previews)
      await this.notification.notify({
        audienceRoles: [Role.ADMIN],
        type: 'WORKER_FEELING_UNWELL',
        title: 'Worker Reported Feeling Unwell',
        body: `Worker ${worker?.workerCode ?? workerId} submitted a symptom report requiring health worker review.`,
        entityType: 'SymptomReport',
        entityId: report.id,
        dedupeKey: `unwell:${report.id}:admin`,
      });
    }

    // Check translation if note contains non-English text
    if (input.note) {
      await this.translation.recordTranslation({
        entityType: 'SymptomReport',
        entityId: report.id,
        fieldName: 'note',
        sourceText: input.note,
      });
    }

    await this.audit.record({
      actorId: userId,
      action: 'SYMPTOM_REPORTED',
      entityType: 'SymptomReport',
      entityId: report.id,
      metadata: { workerId },
    });
    return report;
  }

  async submitTravelRecord(workerId: string, userId: string, input: TravelRecordInput) {
    if (input.idempotencyKey) {
      const prior = await this.idempotency.lookup('travel_record', input.idempotencyKey);
      if (prior) {
        return this.prisma.travelRecord.findUnique({ where: { id: prior } });
      }
    }
    const record = await this.prisma.travelRecord.create({
      data: {
        workerId,
        planningTravel: input.planningTravel ?? false,
        departureDate: parseValidDate(input.departureDate, 'departureDate'),
        returnDate: parseValidDate(input.returnDate, 'returnDate'),
        destination: input.destination ?? null,
        state: input.state ?? null,
        hadFeverOrMalaria: input.hadFeverOrMalaria ?? false,
        treatmentGiven: input.treatmentGiven ?? false,
        completedCourse: input.completedCourse ?? false,
        treatmentPlace: input.treatmentPlace ?? null,
        status: input.status ?? 'SUBMITTED',
      },
    });
    if (input.idempotencyKey) {
      await this.idempotency.record('travel_record', input.idempotencyKey, userId, record.id);
    }
    await this.audit.record({
      actorId: userId,
      action: 'TRAVEL_RECORDED',
      entityType: 'TravelRecord',
      entityId: record.id,
      metadata: { workerId },
    });
    return record;
  }

  async respondFollowUp(workerId: string, input: FollowUpResponseInput) {
    const followUp = await this.prisma.followUp.findUnique({ where: { id: input.followUpId } });
    if (!followUp) throw new NotFoundException('Follow-up not found');
    if (followUp.workerId !== workerId) throw new ForbiddenException('Not your follow-up');
    return this.prisma.followUp.update({
      where: { id: followUp.id },
      data: { response: input.response, note: input.note ?? null, respondedAt: new Date() },
    });
  }

  // ---- authorized clinical writes (NOT worker) ----------------------------

  async createEpisode(workerCode: string, onsetDate?: string) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');
    return this.prisma.malariaEpisode.create({
      data: { workerId: worker.id, onsetDate: parseValidDate(onsetDate, 'onsetDate') },
    });
  }

  async createDiagnostic(createdById: string, input: DiagnosticResultInput) {
    const episode = await this.prisma.malariaEpisode.findUnique({ where: { id: input.episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    const validTestDate = parseValidDate(input.testDate, 'testDate');
    if (!validTestDate) throw new BadRequestException('testDate is required');
    const diag = await this.prisma.diagnosticResult.create({
      data: {
        episodeId: input.episodeId,
        testType: input.testType,
        result: input.result,
        species: input.species ?? null,
        testDate: validTestDate,
        createdById,
      },
    });
    if (input.result === 'POSITIVE') {
      if (episode.status !== 'CONFIRMED') {
        await this.prisma.malariaEpisode.update({ where: { id: episode.id }, data: { status: 'CONFIRMED' } });
      }

      // Fan-out notifications:
      const worker = await this.prisma.worker.findUnique({
        where: { id: episode.workerId },
        include: { screening: true },
      });

      const facilityId = worker?.screening?.facilityId;
      const screenedById = worker?.screening?.screenedById;

      // 1. Notify screening Health Worker if known
      if (screenedById) {
        await this.notification.notify({
          audienceUserIds: [screenedById],
          type: 'POSITIVE_MALARIA_RESULT',
          title: 'Confirmed Positive Malaria Result',
          body: `Worker ${worker?.workerCode ?? episode.workerId} tested POSITIVE for malaria (${diag.testType}).`,
          entityType: 'DiagnosticResult',
          entityId: diag.id,
          dedupeKey: `pos_diag:${diag.id}:hw:${screenedById}`,
        });
      }

      // 2. Notify Facility inbox and assigned Clinicians
      if (facilityId) {
        await this.notification.notify({
          audienceFacilityIds: [facilityId],
          type: 'POSITIVE_MALARIA_RESULT',
          title: 'Confirmed Positive Malaria Result at Facility',
          body: `Worker ${worker?.workerCode ?? episode.workerId} tested POSITIVE for malaria (${diag.testType}).`,
          entityType: 'DiagnosticResult',
          entityId: diag.id,
          dedupeKey: `pos_diag:${diag.id}:fac:${facilityId}`,
        });

        const assignments = await this.prisma.facilityStaffAssignment.findMany({
          where: { facilityId, active: true, role: 'CLINICIAN' },
          select: { userId: true },
        });
        const clinicianUserIds = assignments.map((a) => a.userId);
        if (clinicianUserIds.length > 0) {
          await this.notification.notify({
            audienceUserIds: clinicianUserIds,
            type: 'POSITIVE_MALARIA_RESULT',
            title: 'Confirmed Positive Malaria Result (Assigned Facility)',
            body: `Worker ${worker?.workerCode ?? episode.workerId} tested POSITIVE for malaria (${diag.testType}). Please review.`,
            entityType: 'DiagnosticResult',
            entityId: diag.id,
            dedupeKey: `pos_diag:${diag.id}:clinicians`,
          });
        }
      }

      // 3. Notify Admin
      await this.notification.notify({
        audienceRoles: [Role.ADMIN],
        type: 'POSITIVE_MALARIA_RESULT',
        title: 'Confirmed Positive Malaria Result',
        body: `Worker ${worker?.workerCode ?? episode.workerId} tested POSITIVE for malaria (${diag.testType}).`,
        entityType: 'DiagnosticResult',
        entityId: diag.id,
        dedupeKey: `pos_diag:${diag.id}:admin`,
      });
    }

    await this.audit.record({
      actorId: createdById,
      action: 'DIAGNOSTIC_RECORDED',
      entityType: 'DiagnosticResult',
      entityId: diag.id,
      metadata: { episodeId: input.episodeId, result: input.result },
    });
    return diag;
  }

  async createHouseholdAssessment(createdById: string, input: CreateHouseholdAssessmentInput) {
    const member = await this.prisma.householdMember.findUnique({
      where: { id: input.memberId },
      include: { worker: true },
    });
    if (!member) throw new NotFoundException('Household member not found');

    const assessment = await this.prisma.householdAssessment.create({
      data: {
        memberId: input.memberId,
        clinicianId: createdById,
        symptoms: (input.symptoms ?? []) as Prisma.InputJsonValue,
        testRequested: input.rdtPerformed || Boolean(input.rdtResult),
        testType: input.rdtPerformed || input.rdtResult ? 'RDT' : null,
        testResult: (input.rdtResult as any) ?? null,
        diagnosis: input.suspectedMalaria || input.rdtResult === 'POSITIVE' ? 'Confirmed Malaria' : null,
        clinicalNotes: input.notes ?? null,
      },
    });

    if (input.notes) {
      await this.translation.recordTranslation({
        entityType: 'HouseholdAssessment',
        entityId: assessment.id,
        fieldName: 'clinicalNotes',
        sourceText: input.notes,
      });
    }

    // If RDT result is POSITIVE or suspected malaria, trigger notification
    if (input.rdtResult === 'POSITIVE' || input.suspectedMalaria) {
      const title = input.rdtResult === 'POSITIVE'
        ? 'Household Member Positive Malaria Result'
        : 'Household Member Suspected Malaria';
      const body = `Household member ${member.memberCode} (${member.relationship} of worker ${member.worker.workerCode}) flagged: ${input.rdtResult ?? 'Suspected malaria'}.`;

      await this.notification.notify({
        audienceRoles: [Role.ADMIN],
        type: 'HOUSEHOLD_MALARIA_ALERT',
        title,
        body,
        entityType: 'HouseholdAssessment',
        entityId: assessment.id,
        dedupeKey: `hh_assess:${assessment.id}:admin`,
      });
    }

    await this.audit.record({
      actorId: createdById,
      action: 'HOUSEHOLD_ASSESSMENT_RECORDED',
      entityType: 'HouseholdAssessment',
      entityId: assessment.id,
      metadata: {
        memberId: input.memberId,
        rdtResult: input.rdtResult,
      },
    });

    return {
      ...assessment,
      rdtResult: assessment.testResult,
    };
  }

  listHouseholdAssessments(memberId: string) {
    return this.prisma.householdAssessment.findMany({
      where: { memberId },
      include: {
        clinician: { select: { id: true, displayName: true, role: true } },
      },
      orderBy: { assessedAt: 'desc' },
    });
  }

  async createPrescription(issuedById: string, body: { episodeId: string; details: string }) {
    if (!body.details?.trim()) throw new BadRequestException('Prescription details are required');
    const episode = await this.prisma.malariaEpisode.findUnique({ where: { id: body.episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    // Append-only: a new prescription never overwrites an older one.
    return this.prisma.prescription.create({
      data: { episodeId: body.episodeId, workerId: episode.workerId, details: body.details, issuedById },
    });
  }
}
