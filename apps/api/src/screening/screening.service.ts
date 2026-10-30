import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  evaluateScreeningCompleteness,
  QUESTIONNAIRE_VERSION,
  type CompleteScreeningInput,
  type SaveScreeningDraftInput,
  type ScreeningAnswers,
} from '@m3/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getForWorker(workerId: string) {
    return this.prisma.initialScreening.findUnique({ where: { workerId } });
  }

  async saveDraft(workerId: string, input: SaveScreeningDraftInput) {
    const existing = await this.prisma.initialScreening.findUnique({ where: { workerId } });
    if (existing?.status === 'COMPLETE') {
      // Completed baseline is not re-opened as a draft (§3.5 data rule).
      throw new ConflictException('Initial screening is already complete and cannot be edited as a draft');
    }
    return this.prisma.initialScreening.upsert({
      where: { workerId },
      create: {
        workerId,
        status: 'DRAFT',
        version: QUESTIONNAIRE_VERSION,
        consentGiven: input.consentGiven,
        answers: input.answers as Prisma.InputJsonValue,
      },
      update: {
        consentGiven: input.consentGiven,
        answers: input.answers as Prisma.InputJsonValue,
      },
    });
  }

  async complete(workerId: string, input: CompleteScreeningInput) {
    const existing = await this.prisma.initialScreening.findUnique({ where: { workerId } });
    if (existing?.status === 'COMPLETE') {
      throw new ConflictException('Initial screening has already been completed for this worker');
    }

    const check = evaluateScreeningCompleteness(input.answers as ScreeningAnswers, input.consentGiven);
    if (!check.complete) {
      throw new BadRequestException({
        message: 'Screening is incomplete',
        missingFieldIds: check.missingFieldIds,
        consentMissing: check.consentMissing,
      });
    }

    const screening = await this.prisma.initialScreening.upsert({
      where: { workerId },
      create: {
        workerId,
        status: 'COMPLETE',
        version: QUESTIONNAIRE_VERSION,
        consentGiven: true,
        answers: input.answers as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
      update: {
        status: 'COMPLETE',
        consentGiven: true,
        answers: input.answers as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: null,
      action: 'SCREENING_COMPLETED',
      entityType: 'InitialScreening',
      entityId: screening.id,
      metadata: { workerId, version: QUESTIONNAIRE_VERSION },
    });
    return screening;
  }
}
