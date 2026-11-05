import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  evaluateScreeningCompleteness,
  QUESTIONNAIRE_VERSION,
  type CompleteScreeningInput,
  type SaveScreeningDraftInput,
  type ScreeningAnswers,
} from '@m3/shared';
import { Role, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { TranslationService } from '../common/translation.service';

@Injectable()
export class ScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly translation: TranslationService,
  ) {}

  async getForWorker(workerId: string) {
    return this.prisma.initialScreening.findUnique({ where: { workerId } });
  }

  async saveDraft(workerId: string, input: SaveScreeningDraftInput) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const existing = await this.prisma.initialScreening.findUnique({ where: { workerId } });
    if (existing?.status === 'COMPLETE') {
      // Completed baseline is not re-opened as a draft (§3.5 data rule).
      throw new ConflictException('Initial screening is already complete and cannot be edited as a draft');
    }

    // Backend Protection: Ensure worker registered name and phone number cannot be modified or forged via answers
    const safeAnswers = {
      ...((input.answers as Record<string, unknown>) || {}),
      full_name: worker.name,
      mobile_number: worker.phone,
    };

    return this.prisma.initialScreening.upsert({
      where: { workerId },
      create: {
        workerId,
        status: 'DRAFT',
        version: QUESTIONNAIRE_VERSION,
        consentGiven: input.consentGiven,
        answers: safeAnswers as Prisma.InputJsonValue,
      },
      update: {
        consentGiven: input.consentGiven,
        answers: safeAnswers as Prisma.InputJsonValue,
      },
    });
  }

  async complete(workerId: string, input: CompleteScreeningInput) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const existing = await this.prisma.initialScreening.findUnique({ where: { workerId } });
    if (existing?.status === 'COMPLETE') {
      throw new ConflictException('Initial screening has already been completed for this worker');
    }

    // Validate assisted completion if indicated
    let screenedById: string | null = null;
    if (input.isAssisted) {
      if (!input.assistedByStaffId) {
        throw new BadRequestException('A valid staff ID is required when assisted completion is selected');
      }
      const staffUser = await this.prisma.user.findFirst({
        where: {
          id: input.assistedByStaffId,
          active: true,
          role: { in: [Role.HEALTH_WORKER, Role.CLINICIAN, Role.ADMIN] },
        },
      });
      if (!staffUser) {
        throw new BadRequestException('Invalid or inactive staff member ID provided for assisted completion');
      }
      screenedById = staffUser.id;
    }

    // Backend Protection: Ensure worker registered name and phone number cannot be modified or forged via answers
    const safeAnswers = {
      ...((input.answers as Record<string, unknown>) || {}),
      full_name: worker.name,
      mobile_number: worker.phone,
      isAssisted: Boolean(input.isAssisted),
      assistedByStaffId: screenedById,
    };

    const check = evaluateScreeningCompleteness(safeAnswers as ScreeningAnswers, input.consentGiven);
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
        answers: safeAnswers as Prisma.InputJsonValue,
        screenedById,
        completedAt: new Date(),
      },
      update: {
        status: 'COMPLETE',
        consentGiven: true,
        answers: safeAnswers as Prisma.InputJsonValue,
        screenedById: screenedById ?? existing?.screenedById ?? null,
        completedAt: new Date(),
      },
    });

    // Record non-English free text translations without overwriting original inputs
    const freeTextFields = ['present_address_extra', 'permanent_address_details'];
    for (const field of freeTextFields) {
      const val = (safeAnswers as any)[field];
      if (typeof val === 'string' && val.trim()) {
        await this.translation.recordTranslation({
          entityType: 'InitialScreening',
          entityId: screening.id,
          fieldName: field,
          sourceText: val,
        });
      }
    }

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
