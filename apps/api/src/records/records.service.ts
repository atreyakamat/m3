import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  DiagnosticResultInput,
  FollowUpResponseInput,
  SymptomReportInput,
  TravelRecordInput,
} from '@m3/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { IdempotencyService } from '../common/idempotency.service';

@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ---- worker reads -------------------------------------------------------

  listEpisodes(workerId: string) {
    return this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: { diagnostics: { orderBy: { testDate: 'desc' } } },
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
        departureDate: input.departureDate ? new Date(input.departureDate) : null,
        returnDate: input.returnDate ? new Date(input.returnDate) : null,
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
      data: { workerId: worker.id, onsetDate: onsetDate ? new Date(onsetDate) : null },
    });
  }

  async createDiagnostic(createdById: string, input: DiagnosticResultInput) {
    const episode = await this.prisma.malariaEpisode.findUnique({ where: { id: input.episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    const diag = await this.prisma.diagnosticResult.create({
      data: {
        episodeId: input.episodeId,
        testType: input.testType,
        result: input.result,
        species: input.species ?? null,
        testDate: new Date(input.testDate),
        createdById,
      },
    });
    if (input.result === 'POSITIVE' && episode.status !== 'CONFIRMED') {
      await this.prisma.malariaEpisode.update({ where: { id: episode.id }, data: { status: 'CONFIRMED' } });
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
