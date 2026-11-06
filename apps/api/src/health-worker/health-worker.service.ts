import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import {
  Role,
  EpisodeStatus,
  TestType,
  TravelDirection,
} from '@prisma/client';
import type {
  SuspectedCaseInput,
  TestRequestInput,
  HealthWorkerFollowUpInput,
  HealthWorkerScreeningInput,
  HealthWorkerHouseholdScreeningInput,
} from '@m3/shared';

@Injectable()
export class HealthWorkerService {
  private activeFacilityMap = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
  ) {}

  // ─── Facility Access Guard ────────────────────────────────────────────────

  async assertFacilityAccess(userId: string, facilityId: string) {
    const assignment = await this.prisma.facilityStaffAssignment.findFirst({
      where: {
        userId,
        facilityId,
        active: true,
      },
      include: { facility: true },
    });
    if (!assignment) {
      throw new ForbiddenException('Health Worker is not assigned to this facility');
    }
    return assignment.facility;
  }

  // ─── Profile & Facility Selection ─────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        facilityAssignments: {
          where: { active: true },
          include: { facility: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const assignedFacilities = user.facilityAssignments.map((a) => a.facility);
    const activeFacilityId = this.activeFacilityMap.get(userId);
    const activeFacility =
      (activeFacilityId && assignedFacilities.find((f) => f.id === activeFacilityId)) ||
      (assignedFacilities.length > 0 ? assignedFacilities[0] : null);

    return {
      userId: user.id,
      displayName: user.displayName,
      staffCode: user.stakeholderCode ?? null,
      phone: user.phone ?? null,
      role: user.role,
      assignedFacilities,
      activeFacility,
    };
  }

  async setActiveFacility(userId: string, facilityId: string) {
    const facility = await this.assertFacilityAccess(userId, facilityId);
    this.activeFacilityMap.set(userId, facility.id);
    return {
      activeFacility: facility,
      switchedAt: new Date().toISOString(),
    };
  }

  // ─── Dashboard Statistics ─────────────────────────────────────────────────

  async getDashboard(userId: string, facilityId?: string) {
    let targetFacilityId = facilityId;
    if (!targetFacilityId) {
      const firstAssignment = await this.prisma.facilityStaffAssignment.findFirst({
        where: { userId, active: true },
      });
      if (!firstAssignment) {
        throw new ForbiddenException('Health Worker has no active facility assignments');
      }
      targetFacilityId = firstAssignment.facilityId;
    }

    const facility = await this.assertFacilityAccess(userId, targetFacilityId);

    // 1. Workers screened at this facility
    const facilityScreenings = await this.prisma.initialScreening.findMany({
      where: { facilityId: targetFacilityId },
      select: { workerId: true, status: true },
    });
    const screenedWorkerIds = new Set(facilityScreenings.map((s) => s.workerId));

    // 2. Workers assigned to construction sites in the facility's taluka or district
    const siteAssignments = await this.prisma.workerSiteAssignment.findMany({
      where: {
        active: true,
        site: {
          area: {
            OR: [
              { name: facility.taluka },
              { parent: { name: facility.taluka } },
              { parent: { parent: { name: facility.district } } },
            ],
          },
        },
      },
      select: { workerId: true },
    });
    const talukaWorkerIds = new Set(siteAssignments.map((a) => a.workerId));

    // Union of all workers under the facility's surveillance scope
    const scopedWorkerIds = Array.from(new Set([...screenedWorkerIds, ...talukaWorkerIds]));

    const totalAssignedWorkers = scopedWorkerIds.length;

    const screenedCount = facilityScreenings.filter((s) => s.status === 'COMPLETE').length;

    // Workers awaiting screening in this area
    const completedWorkerIds = new Set(
      facilityScreenings.filter((s) => s.status === 'COMPLETE').map((s) => s.workerId),
    );
    const awaitingScreening = Array.from(talukaWorkerIds).filter((id) => !completedWorkerIds.has(id)).length;

    // 3. Suspected malaria cases in scope
    const suspectedCases = await this.prisma.malariaEpisode.count({
      where: {
        workerId: { in: scopedWorkerIds.length > 0 ? scopedWorkerIds : ['none'] },
        status: EpisodeStatus.SUSPECTED,
      },
    });

    // 4. Confirmed positive & negative diagnostic results
    const confirmedPositiveCases = await this.prisma.diagnosticResult.count({
      where: {
        episode: {
          workerId: { in: scopedWorkerIds.length > 0 ? scopedWorkerIds : ['none'] },
        },
        result: 'POSITIVE',
      },
    });

    const confirmedNegativeCases = await this.prisma.diagnosticResult.count({
      where: {
        episode: {
          workerId: { in: scopedWorkerIds.length > 0 ? scopedWorkerIds : ['none'] },
        },
        result: 'NEGATIVE',
      },
    });

    // 5. Pending follow-ups
    const pendingFollowUps = await this.prisma.followUp.count({
      where: {
        workerId: { in: scopedWorkerIds.length > 0 ? scopedWorkerIds : ['none'] },
        response: null,
      },
    });

    // 6. New travel arrivals
    const newTravelArrivals = await this.prisma.travelRecord.count({
      where: {
        direction: TravelDirection.ENTERING_GOA,
        arrivalFacilityId: null,
      },
    });

    // 7. Feeling unwell reports
    const newFeelingUnwellReports = await this.prisma.symptomReport.count({
      where: {
        workerId: { in: scopedWorkerIds.length > 0 ? scopedWorkerIds : ['none'] },
      },
    });

    return {
      facility: {
        id: facility.id,
        facilityCode: facility.facilityCode,
        name: facility.name,
        type: facility.type,
        taluka: facility.taluka,
        district: facility.district,
      },
      totalAssignedWorkers,
      awaitingScreening,
      screenedCount,
      suspectedCases,
      confirmedPositiveCases,
      confirmedNegativeCases,
      pendingFollowUps,
      newTravelArrivals,
      newFeelingUnwellReports,
    };
  }

  // ─── Worker and Household Search ──────────────────────────────────────────

  async search(userId: string, q: string, facilityId?: string) {
    if (facilityId) {
      await this.assertFacilityAccess(userId, facilityId);
    }

    const term = (q || '').trim();
    if (!term) return { workers: [], householdMembers: [] };

    // Search workers by code, name, phone, or active pass token prefix
    const workers = await this.prisma.worker.findMany({
      where: {
        OR: [
          { workerCode: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
          {
            passTokens: {
              some: {
                tokenPrefix: { contains: term, mode: 'insensitive' },
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
            },
          },
        ],
      },
      include: {
        screening: true,
        assignments: {
          where: { active: true },
          include: { site: true },
        },
        episodes: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { diagnostics: true },
        },
      },
      take: 20,
    });

    // Search household members by memberCode, fullName, or phone
    const householdMembers = await this.prisma.householdMember.findMany({
      where: {
        OR: [
          { memberCode: { contains: term, mode: 'insensitive' } },
          { fullName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
        ],
      },
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
          },
        },
        assessments: {
          take: 1,
          orderBy: { assessedAt: 'desc' },
        },
      },
      take: 20,
    });

    return {
      workers: workers.map((w) => ({
        id: w.id,
        workerCode: w.workerCode,
        name: w.name,
        phone: w.phone,
        preferredLanguage: w.preferredLanguage,
        currentSite: w.assignments[0]?.site?.name ?? null,
        screeningStatus: w.screening?.status ?? 'NOT_STARTED',
        latestMalariaStatus: w.episodes[0]?.diagnostics[0]?.result ?? 'NO_RECORD',
      })),
      householdMembers: householdMembers.map((h) => ({
        id: h.id,
        memberCode: h.memberCode,
        fullName: h.fullName,
        relationship: h.relationship,
        ageOrDob: h.ageOrDob,
        gender: h.gender,
        isDependent: h.isDependent,
        active: h.active,
        primaryWorker: {
          id: h.worker.id,
          workerCode: h.worker.workerCode,
          name: h.worker.name,
        },
        latestAssessment: h.assessments[0]
          ? {
              assessedAt: h.assessments[0].assessedAt,
              diagnosis: h.assessments[0].diagnosis,
              testResult: h.assessments[0].testResult,
            }
          : null,
      })),
    };
  }

  async getWorker(userId: string, workerId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        screening: {
          include: { facility: true, screenedBy: { select: { displayName: true } } },
        },
        assignments: {
          where: { active: true },
          include: { site: true, contractor: true },
        },
        episodes: {
          orderBy: { createdAt: 'desc' },
          include: {
            diagnostics: { orderBy: { testDate: 'desc' } },
            prescriptions: { orderBy: { issuedAt: 'desc' } },
          },
        },
        followUps: { orderBy: { createdAt: 'desc' } },
        travelRecords: { orderBy: { createdAt: 'desc' } },
        householdMembers: {
          where: { active: true },
          include: { assessments: { orderBy: { assessedAt: 'desc' } } },
        },
        symptomReports: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  async getHouseholdMember(userId: string, memberId: string) {
    const member = await this.prisma.householdMember.findUnique({
      where: { id: memberId },
      include: {
        worker: {
          include: {
            assignments: { where: { active: true }, include: { site: true } },
          },
        },
        assessments: {
          orderBy: { assessedAt: 'desc' },
          include: { clinician: { select: { displayName: true, role: true } } },
        },
      },
    });
    if (!member) throw new NotFoundException('Household member not found');
    return member;
  }

  // ─── Screening Workflow ───────────────────────────────────────────────────

  async recordScreening(userId: string, input: HealthWorkerScreeningInput) {
    await this.assertFacilityAccess(userId, input.facilityId);

    const worker = await this.prisma.worker.findUnique({ where: { id: input.workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const mergedAnswers = {
      ...input.answers,
      clinicalObservations: input.clinicalObservations ?? null,
      isAssisted: true,
      assistedByStaffId: userId,
    };

    const screening = await this.prisma.initialScreening.upsert({
      where: { workerId: input.workerId },
      update: {
        facilityId: input.facilityId,
        screenedById: userId,
        status: 'COMPLETE',
        answers: mergedAnswers,
        completedAt: new Date(),
      },
      create: {
        workerId: input.workerId,
        facilityId: input.facilityId,
        screenedById: userId,
        status: 'COMPLETE',
        version: '1.0',
        consentGiven: true,
        answers: mergedAnswers,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'HEALTH_WORKER_SCREENING_COMPLETED',
      entityType: 'InitialScreening',
      entityId: screening.id,
      metadata: {
        workerId: input.workerId,
        facilityId: input.facilityId,
      },
    });

    return screening;
  }

  async recordHouseholdScreening(userId: string, input: HealthWorkerHouseholdScreeningInput) {
    await this.assertFacilityAccess(userId, input.facilityId);

    const member = await this.prisma.householdMember.findUnique({ where: { id: input.memberId } });
    if (!member) throw new NotFoundException('Household member not found');

    const assessment = await this.prisma.householdAssessment.create({
      data: {
        memberId: input.memberId,
        clinicianId: userId,
        symptoms: input.symptoms,
        clinicalHistory: input.clinicalHistory ?? null,
        examinationFindings: input.examinationFindings ?? null,
        testRequested: input.testRequested ?? false,
        testType: input.testType ?? null,
        diagnosis: input.diagnosis ?? null,
        treatment: input.treatment ?? null,
        referralInfo: input.referralInfo ?? null,
        followUpRequired: input.followUpRequired ?? false,
        nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null,
        clinicalNotes: input.clinicalNotes ?? null,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'HOUSEHOLD_ASSESSMENT_RECORDED',
      entityType: 'HouseholdAssessment',
      entityId: assessment.id,
      metadata: {
        memberId: input.memberId,
        facilityId: input.facilityId,
        testRequested: input.testRequested,
      },
    });

    // If test is requested or diagnosis indicates malaria, dispatch clinical notification
    const isSuspectedOrPositive =
      input.testRequested ||
      (input.diagnosis &&
        (input.diagnosis.toLowerCase().includes('positive') ||
          input.diagnosis.toLowerCase().includes('malaria') ||
          input.diagnosis.toLowerCase().includes('suspected')));

    if (isSuspectedOrPositive) {
      await this.notification.notify({
        audienceRoles: [Role.CLINICIAN, Role.ADMIN],
        type: 'HOUSEHOLD_MEMBER_MALARIA_ALERT',
        title: 'Household Member Malaria Alert',
        body: `Malaria suspected/diagnosed for household member ${member.memberCode} (${member.fullName || 'Family Member'}). Immediate clinical review required.`,
        entityType: 'HouseholdAssessment',
        entityId: assessment.id,
        dedupeKey: `hh_assessment_alert:${assessment.id}`,
      });
    }

    return assessment;
  }

  async updateHouseholdMemberStatus(userId: string, memberId: string, active: boolean) {
    const member = await this.prisma.householdMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Household member not found');

    const updated = await this.prisma.householdMember.update({
      where: { id: memberId },
      data: { active },
    });

    await this.audit.record({
      actorId: userId,
      action: active ? 'HOUSEHOLD_MEMBER_REACTIVATED' : 'HOUSEHOLD_MEMBER_DEACTIVATED',
      entityType: 'HouseholdMember',
      entityId: memberId,
      metadata: { previousActive: member.active, newActive: active, workerId: member.workerId },
    });

    return updated;
  }

  // ─── Suspected Cases & Test Requests ──────────────────────────────────────

  async recordSuspectedCase(userId: string, input: SuspectedCaseInput) {
    await this.assertFacilityAccess(userId, input.facilityId);

    const worker = await this.prisma.worker.findUnique({ where: { id: input.workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const episode = await this.prisma.malariaEpisode.create({
      data: {
        workerId: input.workerId,
        status: EpisodeStatus.SUSPECTED,
        onsetDate: input.onsetDate ? new Date(input.onsetDate) : new Date(),
      },
    });

    // Record symptoms if provided
    if (input.symptoms && input.symptoms.length > 0) {
      await this.prisma.symptomReport.create({
        data: {
          workerId: input.workerId,
          episodeId: episode.id,
          symptoms: input.symptoms,
          note: input.clinicalObservations || input.notes || 'Recorded by Health Worker during field screening',
        },
      });
    }

    await this.audit.record({
      actorId: userId,
      action: 'SUSPECTED_CASE_RECORDED',
      entityType: 'MalariaEpisode',
      entityId: episode.id,
      metadata: {
        workerId: input.workerId,
        facilityId: input.facilityId,
      },
    });

    return episode;
  }

  async recordTestRequest(userId: string, input: TestRequestInput) {
    await this.assertFacilityAccess(userId, input.facilityId);

    const episode = await this.prisma.malariaEpisode.findUnique({ where: { id: input.episodeId } });
    if (!episode) throw new NotFoundException('Malaria episode not found');

    if (input.labReferralRequired && input.referralFacilityId) {
      await this.notification.notify({
        audienceFacilityIds: [input.referralFacilityId],
        type: 'LAB_TEST_REQUESTED',
        title: 'Laboratory Referral: Test Requested',
        body: `Test request (${input.testType}) initiated by Health Worker for worker ${input.workerId}.`,
        entityType: 'MalariaEpisode',
        entityId: episode.id,
        dedupeKey: `lab_req:${episode.id}:${input.testType}`,
      });
    }

    await this.audit.record({
      actorId: userId,
      action: 'DIAGNOSTIC_TEST_REQUESTED',
      entityType: 'MalariaEpisode',
      entityId: episode.id,
      metadata: {
        testType: input.testType,
        facilityId: input.facilityId,
        sampleDetails: input.sampleDetails,
      },
    });

    return {
      episodeId: episode.id,
      testType: input.testType,
      status: 'TEST_REQUESTED',
      sampleDetails: input.sampleDetails ?? null,
      notes: input.notes ?? null,
      labReferralRequired: input.labReferralRequired,
      requestedAt: new Date().toISOString(),
    };
  }

  // ─── Follow-up and Referral ───────────────────────────────────────────────

  async listFollowUps(userId: string, facilityId: string) {
    await this.assertFacilityAccess(userId, facilityId);

    const facilityScreenings = await this.prisma.initialScreening.findMany({
      where: { facilityId },
      select: { workerId: true },
    });
    const screenedWorkerIds = facilityScreenings.map((s) => s.workerId);

    return this.prisma.followUp.findMany({
      where: {
        OR: [
          { workerId: { in: screenedWorkerIds } },
          { worker: { screening: { facilityId } } },
          { worker: { travelRecords: { some: { arrivalFacilityId: facilityId } } } },
          { worker: { episodes: { some: { status: { in: [EpisodeStatus.SUSPECTED, EpisodeStatus.CONFIRMED] } } } } },
        ],
      },
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordFollowUp(userId: string, input: HealthWorkerFollowUpInput) {
    const worker = await this.prisma.worker.findUnique({ where: { id: input.workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const followUp = await this.prisma.followUp.create({
      data: {
        workerId: input.workerId,
        episodeId: input.episodeId ?? null,
        question: input.question,
        response: input.response,
        note: input.note ?? null,
        respondedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'FOLLOW_UP_RECORDED',
      entityType: 'FollowUp',
      entityId: followUp.id,
      metadata: {
        workerId: input.workerId,
        attendedReferral: input.attendedReferral,
        referralFacilityId: input.referralFacilityId,
      },
    });

    return followUp;
  }

  // ─── Travel & Arrival Screening ───────────────────────────────────────────

  async listTravelArrivals(userId: string, facilityId: string) {
    await this.assertFacilityAccess(userId, facilityId);

    return this.prisma.travelRecord.findMany({
      where: {
        direction: TravelDirection.ENTERING_GOA,
      },
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
          },
        },
        arrivalFacility: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Symptom Reports Review ───────────────────────────────────────────────

  async listSymptomReports(userId: string, facilityId: string) {
    await this.assertFacilityAccess(userId, facilityId);

    return this.prisma.symptomReport.findMany({
      include: {
        worker: {
          select: {
            id: true,
            workerCode: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reviewSymptomReport(userId: string, reportId: string, actionTaken: string) {
    const report = await this.prisma.symptomReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Symptom report not found');

    await this.audit.record({
      actorId: userId,
      action: 'SYMPTOM_REPORT_REVIEWED',
      entityType: 'SymptomReport',
      entityId: report.id,
      metadata: {
        actionTaken,
      },
    });

    return {
      reviewed: true,
      reportId: report.id,
      actionTaken,
      reviewedAt: new Date().toISOString(),
    };
  }

  // ─── Facility Inbox Notifications ─────────────────────────────────────────

  async getFacilityInbox(userId: string, facilityId?: string) {
    const targetFacilityId = facilityId || this.activeFacilityMap.get(userId);
    if (!targetFacilityId) {
      const assignment = await this.prisma.facilityStaffAssignment.findFirst({
        where: { userId, active: true },
      });
      if (!assignment) throw new ForbiddenException('No facility assigned');
      return this.fetchInboxForFacility(assignment.facilityId, userId);
    }
    await this.assertFacilityAccess(userId, targetFacilityId);
    return this.fetchInboxForFacility(targetFacilityId, userId);
  }

  private async fetchInboxForFacility(facilityId: string, userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { audienceFacilityId: facilityId },
          { audienceUserId: userId },
        ],
      },
      include: {
        audienceFacility: {
          select: { id: true, name: true, facilityCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = notifications.filter((n) => !n.readAt).length;
    const unacknowledgedCount = notifications.filter((n) => !n.acknowledgedAt).length;

    return {
      facilityId,
      notifications,
      unreadCount,
      unacknowledgedCount,
    };
  }

  async acknowledgeNotification(userId: string, notificationId: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: notif.readAt ?? new Date(),
        acknowledgedAt: notif.acknowledgedAt ?? new Date(),
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'NOTIFICATION_ACKNOWLEDGED',
      entityType: 'Notification',
      entityId: notif.id,
    });

    return updated;
  }

  async actionNotification(userId: string, notificationId: string, actionTaken: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: notif.readAt ?? new Date(),
        acknowledgedAt: notif.acknowledgedAt ?? new Date(),
        actionTaken,
        actionTakenAt: new Date(),
        actionTakenById: userId,
      },
    });

    await this.audit.record({
      actorId: userId,
      action: 'NOTIFICATION_ACTION_RECORDED',
      entityType: 'Notification',
      entityId: notif.id,
      metadata: { actionTaken },
    });

    return updated;
  }
}
