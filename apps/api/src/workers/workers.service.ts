import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Language } from '@prisma/client';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import {
  deriveMalariaStatus,
  type MalariaStatus,
  type CreateHouseholdMemberInput,
  type UpdateHouseholdMemberInput,
  type ProfileCorrectionInput,
  type AppInstallConsentInput,
  type DataSubmissionConsentInput,
  ALLOWED_CORRECTION_FIELDS,
  type AllowedCorrectionField,
} from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';

@Injectable()
export class WorkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
  ) {}

  /** First-time construction-site selection. Later changes go via Transfer. */
  async assignInitialSite(workerId: string, siteCode: string) {
    if (!siteCode || typeof siteCode !== 'string' || !siteCode.trim()) {
      throw new BadRequestException('siteCode is required');
    }
    const active = await this.prisma.workerSiteAssignment.findFirst({ where: { workerId, active: true } });
    if (active) {
      throw new ConflictException('You already have an active site; use Transfer to change sites');
    }
    const site = await this.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site || !site.active) throw new NotFoundException('Site not found or inactive');

    const assignment = await this.prisma.workerSiteAssignment.create({
      data: {
        workerId,
        siteId: site.id,
        contractorId: site.contractorId ?? null,
        active: true,
        status: 'ACTIVE',
      },
    });
    await this.audit.record({
      actorId: null,
      action: 'INITIAL_SITE_ASSIGNED',
      entityType: 'WorkerSiteAssignment',
      entityId: assignment.id,
      metadata: { workerId, siteId: site.id },
    });
    return { siteId: site.siteCode, name: site.name, since: assignment.startedAt.toISOString() };
  }

  async getActiveAssignment(workerId: string) {
    return this.prisma.workerSiteAssignment.findFirst({
      where: { workerId, active: true },
      include: {
        site: { include: { area: true, contractor: true } },
        contractor: true,
      },
    });
  }

  async getMalariaStatus(workerId: string): Promise<MalariaStatus> {
    const episodes = await this.prisma.malariaEpisode.findMany({
      where: { workerId },
      include: { diagnostics: true },
    });
    const results = episodes.flatMap((e) =>
      e.diagnostics.map((d) => ({ result: d.result, testDate: d.testDate.toISOString() })),
    );
    const hasPendingSample = episodes.some(
      (e) => e.status !== 'RESOLVED' && e.diagnostics.length === 0,
    );
    return deriveMalariaStatus(results, hasPendingSample);
  }

  async getProfile(workerId: string) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const [
      assignment,
      screening,
      malariaStatus,
      episodeCount,
      prescriptionCount,
      householdCount,
      dependentCount,
      roommateCount,
    ] = await Promise.all([
      this.getActiveAssignment(workerId),
      this.prisma.initialScreening.findUnique({ where: { workerId } }),
      this.getMalariaStatus(workerId),
      this.prisma.malariaEpisode.count({ where: { workerId } }),
      this.prisma.prescription.count({ where: { workerId } }),
      this.prisma.householdMember.count({ where: { workerId } }),
      this.prisma.householdMember.count({ where: { workerId, isDependent: true } }),
      this.prisma.householdMember.count({
        where: { workerId, OR: [{ livesInSameRoom: false }, { relationship: 'ROOMMATE' }] },
      }),
    ]);

    const currentContractor = assignment?.contractor
      ? { contractorId: assignment.contractor.id, name: assignment.contractor.name }
      : assignment?.site.contractor
        ? { contractorId: assignment.site.contractor.id, name: assignment.site.contractor.name }
        : null;

    return {
      workerId: worker.workerCode,
      name: worker.name,
      phone: worker.phone,
      preferredLanguage: worker.preferredLanguage,
      currentSite: assignment && assignment.site
        ? {
            siteId: assignment.site.siteCode,
            name: assignment.site.name,
            area: assignment.site.area?.name ?? 'Unknown',
            since: assignment.startedAt.toISOString(),
          }
        : null,
      currentContractor,
      screening: screening
        ? { status: screening.status, completedAt: screening.completedAt?.toISOString() ?? null }
        : { status: 'NOT_STARTED', completedAt: null },
      malariaStatus,
      episodeCount,
      prescriptionCount,
      householdStats: {
        totalCount: householdCount,
        dependentCount,
        roommateCount,
      },
    };
  }

  async updatePreferredLanguage(workerId: string, language: Language) {
    const worker = await this.prisma.worker.update({
      where: { id: workerId },
      data: { preferredLanguage: language },
    });
    return { preferredLanguage: worker.preferredLanguage };
  }

  /** Minimal confirmation details a contractor may see when entering a Worker ID. */
  async lookupByCode(workerCode: string) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');
    const assignment = await this.getActiveAssignment(worker.id);
    const currentContractor = assignment?.contractor
      ? { contractorId: assignment.contractor.id, name: assignment.contractor.name }
      : assignment?.site.contractor
        ? { contractorId: assignment.site.contractor.id, name: assignment.site.contractor.name }
        : null;
    return {
      workerId: worker.workerCode,
      name: worker.name,
      currentSite: assignment ? { siteId: assignment.site.siteCode, name: assignment.site.name } : null,
      currentContractor,
    };
  }

  async requireByCode(workerCode: string) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');
    return worker;
  }

  // ---- Worker QR Pass (Spec §4, §6) -------------------------------------------

  /** Generate a secure, single-use, 5-minute server-bound QR token for the Worker. */
  async generatePass(workerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const worker = await tx.worker.findUnique({ where: { id: workerId } });
      if (!worker) throw new NotFoundException('Worker not found');

      const user = await tx.user.findFirst({ where: { workerId } });
      if (user && !user.active) {
        throw new ForbiddenException('Deactivated workers cannot generate pass tokens');
      }

      const now = new Date();
      // Revoke any existing unexpired token for this worker (deduplication & rate protection)
      await tx.workerPassToken.updateMany({
        where: { workerId, expiresAt: { gt: now }, revokedAt: null, usedAt: null },
        data: { revokedAt: now },
      });

      // 32 cryptographically secure random bytes in URL-safe base64
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenPrefix = token.slice(0, 8);
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes expiry

      await tx.workerPassToken.create({
        data: {
          tokenHash,
          tokenPrefix,
          workerId,
          expiresAt,
        },
      });

      await this.audit.record({
        actorId: workerId,
        action: 'WORKER_PASS_GENERATED',
        entityType: 'WorkerPassToken',
        entityId: tokenPrefix,
        metadata: { workerId, tokenPrefix, expiresAt: expiresAt.toISOString() },
        tx,
      });

      return {
        token,
        expiresAt: expiresAt.toISOString(),
        remainingSeconds: 300,
        workerCode: worker.workerCode,
      };
    });
  }

  /** Current pass status, active token remaining lifetime, current site, responsible contractor, pending transfers */
  async getPassStatus(workerId: string) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const [assignment, pendingTransfers, latestToken] = await Promise.all([
      this.getActiveAssignment(workerId),
      this.prisma.siteTransferRequest.findMany({
        where: {
          workerId,
          status: {
            in: [
              'PENDING_WORKER_RESPONSE',
              'PENDING_CURRENT_CONTRACTOR',
              'PENDING_DESTINATION_CONTRACTOR',
            ],
          },
        },
        include: {
          fromSite: true,
          toSite: true,
          fromContractor: true,
          toContractor: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workerPassToken.findFirst({
        where: {
          workerId,
          expiresAt: { gt: new Date() },
          revokedAt: null,
          usedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = Date.now();
    const activeToken = latestToken
      ? {
          expiresAt: latestToken.expiresAt.toISOString(),
          remainingSeconds: Math.max(0, Math.floor((latestToken.expiresAt.getTime() - now) / 1000)),
          tokenPrefix: latestToken.tokenPrefix,
        }
      : null;

    const currentContractor = assignment?.contractor
      ? { contractorId: assignment.contractor.id, name: assignment.contractor.name }
      : assignment?.site.contractor
        ? { contractorId: assignment.site.contractor.id, name: assignment.site.contractor.name }
        : null;

    return {
      workerCode: worker.workerCode,
      name: worker.name,
      currentSite: assignment && assignment.site
        ? { siteId: assignment.site.siteCode, name: assignment.site.name, area: assignment.site.area?.name ?? 'Unknown' }
        : null,
      currentContractor,
      activeToken,
      pendingTransfers: pendingTransfers.map((t) => ({
        id: t.id,
        status: t.status,
        initiatorType: t.initiatorType,
        fromSite: t.fromSite ? { siteId: t.fromSite.siteCode, name: t.fromSite.name } : null,
        toSite: { siteId: t.toSite.siteCode, name: t.toSite.name },
        fromContractor: t.fromContractor ? { contractorId: t.fromContractor.id, name: t.fromContractor.name } : null,
        toContractor: t.toContractor ? { contractorId: t.toContractor.id, name: t.toContractor.name } : null,
        workerDecision: t.workerDecision,
        createdAt: t.createdAt.toISOString(),
        note: t.note,
      })),
    };
  }

  /** Revoke any active pass token for the worker */
  async revokePass(workerId: string) {
    const now = new Date();
    await this.prisma.workerPassToken.updateMany({
      where: { workerId, expiresAt: { gt: now }, revokedAt: null, usedAt: null },
      data: { revokedAt: now },
    });
    await this.audit.record({
      actorId: workerId,
      action: 'WORKER_PASS_REVOKED',
      entityType: 'WorkerPassToken',
      entityId: workerId,
      metadata: { workerId },
    });
    return { revoked: true };
  }

  // ─── Family & Household Members ───────────────────────────────────────────

  async getHouseholdMembers(workerId: string) {
    const members = await this.prisma.householdMember.findMany({
      where: { workerId },
      include: {
        assessments: {
          orderBy: { assessedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalCount = members.length;
    const dependentCount = members.filter((m) => m.isDependent).length;
    const roommateCount = members.filter((m) => !m.livesInSameRoom || m.relationship === 'ROOMMATE').length;

    let screenedCount = 0;
    let awaitingScreening = 0;
    let confirmedPositiveCount = 0;
    let confirmedNegativeCount = 0;

    for (const m of members) {
      if (!m.assessments || m.assessments.length === 0) {
        awaitingScreening++;
      } else {
        screenedCount++;
        const hasPositive = m.assessments.some(
          (a) => a.testResult === 'POSITIVE' || a.diagnosis?.toLowerCase().includes('confirmed') || a.diagnosis?.toLowerCase().includes('positive'),
        );
        const hasNegative = m.assessments.some(
          (a) => a.testResult === 'NEGATIVE',
        );
        if (hasPositive) {
          confirmedPositiveCount++;
        } else if (hasNegative) {
          confirmedNegativeCount++;
        }
      }
    }

    return {
      members,
      stats: {
        totalCount,
        dependentCount,
        roommateCount,
        awaitingScreening,
        screenedCount,
        confirmedPositiveCount,
        confirmedNegativeCount,
      },
    };
  }

  async addHouseholdMember(workerId: string, input: CreateHouseholdMemberInput) {
    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const count = await this.prisma.householdMember.count({ where: { workerId } });
    const memberCode = `${worker.workerCode}-HH-${String(count + 1).padStart(2, '0')}`;

    // Soft duplicate warning check: if member with same name exists, warn but do not block
    let duplicateWarning = false;
    if (input.fullName?.trim()) {
      const existing = await this.prisma.householdMember.findFirst({
        where: {
          workerId,
          fullName: { equals: input.fullName.trim(), mode: 'insensitive' },
        },
      });
      if (existing) duplicateWarning = true;
    }

    const ageOrDob = input.dateOfBirth || (input.ageYears !== undefined && input.ageYears !== null ? String(input.ageYears) : null);

    const member = await this.prisma.householdMember.create({
      data: {
        workerId,
        memberCode,
        fullName: input.fullName?.trim() || null,
        gender: input.gender ?? null,
        ageOrDob,
        relationship: input.relationship,
        isDependent: input.isDependent ?? true,
        livesInSameRoom: !input.isRoommate,
        phoneAvailable: Boolean(input.phone?.trim()),
        phone: input.phone?.trim() || null,
        active: true,
      },
    });

    await this.audit.record({
      actorId: workerId,
      action: 'HOUSEHOLD_MEMBER_ADDED',
      entityType: 'HouseholdMember',
      entityId: member.id,
      metadata: { workerId, memberCode, relationship: input.relationship },
    });

    return {
      ...member,
      duplicateWarning,
    };
  }

  async updateHouseholdMember(workerId: string, memberId: string, input: UpdateHouseholdMemberInput) {
    const member = await this.prisma.householdMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Household member not found');
    if (member.workerId !== workerId) throw new ForbiddenException('Not your household member');

    const ageOrDob = input.dateOfBirth !== undefined
      ? input.dateOfBirth
      : input.ageYears !== undefined && input.ageYears !== null
        ? String(input.ageYears)
        : member.ageOrDob;

    const updated = await this.prisma.householdMember.update({
      where: { id: memberId },
      data: {
        fullName: input.fullName !== undefined ? input.fullName?.trim() || null : member.fullName,
        gender: input.gender !== undefined ? input.gender : member.gender,
        ageOrDob,
        relationship: input.relationship ?? member.relationship,
        isDependent: input.isDependent !== undefined ? input.isDependent : member.isDependent,
        livesInSameRoom: input.isRoommate !== undefined ? !input.isRoommate : member.livesInSameRoom,
        phone: input.phone !== undefined ? input.phone?.trim() || null : member.phone,
        phoneAvailable: input.phone !== undefined ? Boolean(input.phone?.trim()) : member.phoneAvailable,
      },
    });

    await this.audit.record({
      actorId: workerId,
      action: 'HOUSEHOLD_MEMBER_UPDATED',
      entityType: 'HouseholdMember',
      entityId: memberId,
      metadata: { workerId },
    });

    return updated;
  }

  // ─── Profile Demographic Correction Requests ─────────────────────────────

  async requestProfileCorrection(workerId: string, userId: string, input: ProfileCorrectionInput) {
    const field = (input.fieldName || (input as any).field) as AllowedCorrectionField;
    const proposed = (input.requestedValue || (input as any).proposedValue || '').trim();
    const current = input.oldValue || (input as any).currentValue || '';

    if (!field || !ALLOWED_CORRECTION_FIELDS.includes(field)) {
      throw new BadRequestException(
        `Field "${field}" is not eligible for demographic self-service correction.`,
      );
    }
    if (!proposed) {
      throw new BadRequestException('Proposed value is required');
    }

    const worker = await this.prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const request = await this.prisma.profileCorrectionRequest.create({
      data: {
        workerId,
        fieldName: field,
        currentValue: current,
        proposedValue: proposed,
        reason: input.reason?.trim() || 'Demographic profile correction request',
        status: 'SUBMITTED',
      },
    });

    await this.notification.notify({
      audienceRoles: [Role.ADMIN],
      type: 'PROFILE_CORRECTION_REQUESTED',
      title: 'Worker Profile Correction Request',
      body: `Worker ${worker.workerCode} requested change for field: ${field}.`,
      entityType: 'ProfileCorrectionRequest',
      entityId: request.id,
      dedupeKey: `correction_req:${request.id}`,
    });

    await this.audit.record({
      actorId: userId,
      action: 'PROFILE_CORRECTION_REQUESTED',
      entityType: 'ProfileCorrectionRequest',
      entityId: request.id,
      metadata: { workerId, fieldName: field },
    });

    return request;
  }

  listProfileCorrections(workerId: string) {
    return this.prisma.profileCorrectionRequest.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Consent Tracking (Separated Events) ──────────────────────────────────

  async recordInstallConsent(workerId: string, userId: string, input: AppInstallConsentInput) {
    const consent = await this.prisma.appInstallConsent.create({
      data: {
        workerId,
        version: input.consentVersion,
        language: (input.language as any) || 'en',
        status: input.status as any,
        deviceInfo: input.deviceInfo ?? null,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'APP_INSTALL_CONSENT_RECORDED',
      entityType: 'AppInstallConsent',
      entityId: consent.id,
      metadata: { workerId, status: input.status, version: input.consentVersion },
    });

    return consent;
  }

  async recordSubmissionConsent(workerId: string, userId: string, input: DataSubmissionConsentInput) {
    const consent = await this.prisma.dataSubmissionConsent.create({
      data: {
        workerId,
        version: input.consentVersion,
        language: (input.language as any) || 'en',
        status: input.status as any,
        formId: input.screeningId || 'worker-screening-2026-10-31',
        deviceInfo: input.deviceInfo ?? null,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'DATA_SUBMISSION_CONSENT_RECORDED',
      entityType: 'DataSubmissionConsent',
      entityId: consent.id,
      metadata: { workerId, status: input.status, version: input.consentVersion },
    });

    return consent;
  }
}
