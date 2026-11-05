import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFacilityInput,
  AssignStaffInput,
  CreateEscalationAlertInput,
} from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';
import { Role, FacilityType } from '@prisma/client';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notification: NotificationService,
  ) {}

  // ─── Facility Management ──────────────────────────────────────────────────

  async listFacilities(filter?: { type?: string; taluka?: string; isActive?: boolean }) {
    const where: any = {};
    if (filter?.type) where.type = filter.type;
    if (filter?.taluka) where.taluka = filter.taluka;
    if (typeof filter?.isActive === 'boolean') where.active = filter.isActive;

    return this.prisma.facility.findMany({
      where,
      include: {
        staffAssignments: {
          where: { active: true },
          include: {
            user: { select: { id: true, displayName: true, phone: true, role: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getFacility(id: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        staffAssignments: {
          include: {
            user: { select: { id: true, displayName: true, phone: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!facility) throw new NotFoundException('Facility not found');
    return facility;
  }

  async createFacility(input: any, adminUserId: string) {
    const type: FacilityType = input.type || input.facilityType || 'PHC';
    let code: string = (input.facilityCode || '').trim().toUpperCase();
    if (!code) {
      const count = await this.prisma.facility.count({ where: { type } });
      code = `${type}-${String(count + 1).padStart(4, '0')}`;
    }

    const existing = await this.prisma.facility.findUnique({
      where: { facilityCode: code },
    });
    if (existing) {
      throw new ConflictException(`Facility code ${code} already exists`);
    }

    const facility = await this.prisma.facility.create({
      data: {
        facilityCode: code,
        name: (input.name || '').trim(),
        type,
        state: input.state || 'Goa',
        district: (input.district || '').trim(),
        taluka: (input.taluka || '').trim(),
        address: input.address?.trim() || null,
        latitude: input.latitude ? Number(input.latitude) : null,
        longitude: input.longitude ? Number(input.longitude) : null,
        contactPhone: (input.phone || input.contactPhone || '').trim() || null,
        contactEmail: (input.email || input.contactEmail || '').trim().toLowerCase() || null,
        active: input.active ?? input.isActive ?? true,
      },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'FACILITY_CREATED',
      entityType: 'Facility',
      entityId: facility.id,
      metadata: { facilityCode: facility.facilityCode, name: facility.name },
    });

    return facility;
  }

  async updateFacility(id: string, input: Partial<CreateFacilityInput>, adminUserId: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id } });
    if (!facility) throw new NotFoundException('Facility not found');

    const updated = await this.prisma.facility.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? facility.name,
        type: (input.type as any) ?? facility.type,
        district: input.district?.trim() ?? facility.district,
        taluka: input.taluka?.trim() ?? facility.taluka,
        address: input.address !== undefined ? input.address?.trim() || null : facility.address,
        latitude: input.latitude !== undefined ? input.latitude : facility.latitude,
        longitude: input.longitude !== undefined ? input.longitude : facility.longitude,
        contactPhone: input.contactPhone !== undefined ? input.contactPhone?.trim() || null : facility.contactPhone,
        contactEmail: input.contactEmail !== undefined ? input.contactEmail?.trim().toLowerCase() || null : facility.contactEmail,
        active: input.isActive !== undefined ? input.isActive : facility.active,
      },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'FACILITY_UPDATED',
      entityType: 'Facility',
      entityId: updated.id,
      metadata: { facilityCode: updated.facilityCode },
    });

    return updated;
  }

  // ─── Staff Assignments ────────────────────────────────────────────────────

  async assignStaff(input: AssignStaffInput, adminUserId: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id: input.facilityId } });
    if (!facility) throw new NotFoundException('Facility not found');

    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.active) throw new BadRequestException('Cannot assign an inactive user');

    // Strict role validation: User's system role must match the assigned role
    const expectedRole = input.role === 'HEALTH_WORKER' ? Role.HEALTH_WORKER : Role.CLINICIAN;
    if (user.role !== expectedRole) {
      throw new BadRequestException(
        `User role (${user.role}) does not match assigned role (${input.role})`,
      );
    }

    // Check if an active assignment already exists for this user and facility
    const existing = await this.prisma.facilityStaffAssignment.findFirst({
      where: {
        facilityId: input.facilityId,
        userId: input.userId,
        active: true,
      },
    });
    if (existing) {
      throw new ConflictException('User is already actively assigned to this facility');
    }

    const assignment = await this.prisma.facilityStaffAssignment.create({
      data: {
        facilityId: input.facilityId,
        userId: input.userId,
        role: expectedRole,
        active: true,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
      include: {
        user: { select: { id: true, displayName: true, phone: true, role: true } },
        facility: { select: { id: true, name: true, facilityCode: true, type: true } },
      },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'STAFF_ASSIGNED_TO_FACILITY',
      entityType: 'FacilityStaffAssignment',
      entityId: assignment.id,
      metadata: { facilityId: input.facilityId, userId: input.userId, role: input.role },
    });

    return assignment;
  }

  async listStaffAssignments(facilityId: string) {
    return this.prisma.facilityStaffAssignment.findMany({
      where: { facilityId },
      include: {
        user: { select: { id: true, displayName: true, phone: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async endStaffAssignment(assignmentId: string, adminUserId: string) {
    const assignment = await this.prisma.facilityStaffAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Staff assignment not found');

    const updated = await this.prisma.facilityStaffAssignment.update({
      where: { id: assignmentId },
      data: {
        active: false,
        endDate: new Date(),
      },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'STAFF_ASSIGNMENT_ENDED',
      entityType: 'FacilityStaffAssignment',
      entityId: updated.id,
      metadata: { facilityId: updated.facilityId, userId: updated.userId },
    });

    return updated;
  }

  // ─── Nearby Clinicians ────────────────────────────────────────────────────

  async getNearbyClinicians(facilityId: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) throw new NotFoundException('Facility not found');

    const clinicians = await this.prisma.user.findMany({
      where: { role: Role.CLINICIAN, active: true },
      select: {
        id: true,
        displayName: true,
        phone: true,
        facilityAssignments: {
          where: { active: true },
          include: { facility: true },
        },
      },
    });

    const results = clinicians.map((c) => {
      let minDistanceKm: number | null = null;
      let matchedTaluka = false;

      for (const assign of c.facilityAssignments) {
        if (assign.facility.taluka.toLowerCase() === facility.taluka.toLowerCase()) {
          matchedTaluka = true;
        }
        if (
          facility.latitude &&
          facility.longitude &&
          assign.facility.latitude &&
          assign.facility.longitude
        ) {
          const dist = haversineDistance(
            facility.latitude,
            facility.longitude,
            assign.facility.latitude,
            assign.facility.longitude,
          );
          if (minDistanceKm === null || dist < minDistanceKm) {
            minDistanceKm = dist;
          }
        }
      }

      return {
        id: c.id,
        clinicianId: c.id,
        name: c.displayName,
        phone: c.phone,
        activeAssignments: c.facilityAssignments.map((a) => ({
          facilityId: a.facility.id,
          facilityName: a.facility.name,
          type: a.facility.type,
          taluka: a.facility.taluka,
        })),
        distanceKm: minDistanceKm,
        isSameTaluka: matchedTaluka,
      };
    });

    results.sort((a, b) => {
      if (a.isSameTaluka && !b.isSameTaluka) return -1;
      if (!a.isSameTaluka && b.isSameTaluka) return 1;
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });

    return results;
  }

  // ─── Escalation Alerts ────────────────────────────────────────────────────

  async createEscalationAlert(createdById: string, input: CreateEscalationAlertInput) {
    const facility = await this.prisma.facility.findUnique({ where: { id: input.facilityId } });
    if (!facility) throw new NotFoundException('Facility not found');

    const diag = await this.prisma.diagnosticResult.findUnique({
      where: { id: input.diagnosticResultId },
      include: {
        episode: {
          include: { worker: true },
        },
      },
    });
    if (!diag) throw new NotFoundException('Diagnostic result not found');

    const worker = diag.episode.worker;

    const alert = await this.prisma.facilityEscalationAlert.create({
      data: {
        facilityId: input.facilityId,
        diagnosticResultId: input.diagnosticResultId,
        adminId: createdById,
        reason: input.notes || `Clinical escalation (${input.urgency})`,
        status: 'SENT',
        recipients: {
          create: input.clinicianUserIds.map((clinicianId) => ({
            clinicianId,
            status: 'SENT',
            deliveredAt: new Date(),
          })),
        },
      },
      include: {
        recipients: {
          include: {
            clinician: { select: { id: true, displayName: true, phone: true } },
          },
        },
      },
    });

    await this.notification.notify({
      audienceUserIds: input.clinicianUserIds,
      type: 'ESCALATION_ALERT',
      title: `Clinical Escalation Alert (${input.urgency})`,
      body: `Urgent clinical follow-up requested for worker ${worker.workerCode} at ${facility.name} (${facility.type}).`,
      entityType: 'FacilityEscalationAlert',
      entityId: alert.id,
      dedupeKey: `escalation:${alert.id}`,
    });

    await this.notification.notify({
      audienceFacilityIds: [facility.id],
      type: 'FACILITY_ESCALATION_ALERT',
      title: `Clinical Escalation Dispatched`,
      body: `Worker ${worker.workerCode} has been escalated to ${input.clinicianUserIds.length} clinician(s).`,
      entityType: 'FacilityEscalationAlert',
      entityId: alert.id,
      dedupeKey: `facility_escalation:${alert.id}`,
    });

    await this.audit.record({
      actorId: createdById,
      action: 'ESCALATION_ALERT_CREATED',
      entityType: 'FacilityEscalationAlert',
      entityId: alert.id,
      metadata: {
        facilityId: input.facilityId,
        diagnosticResultId: input.diagnosticResultId,
        workerId: worker.id,
        clinicianCount: input.clinicianUserIds.length,
      },
    });

    return alert;
  }

  async listEscalationAlerts(filter?: { facilityId?: string; clinicianUserId?: string }) {
    const where: any = {};
    if (filter?.facilityId) where.facilityId = filter.facilityId;
    if (filter?.clinicianUserId) {
      where.recipients = { some: { clinicianId: filter.clinicianUserId } };
    }

    return this.prisma.facilityEscalationAlert.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, facilityCode: true, type: true } },
        diagnosticResult: {
          include: {
            episode: {
              include: {
                worker: { select: { id: true, workerCode: true, name: true, phone: true } },
              },
            },
          },
        },
        recipients: {
          include: {
            clinician: { select: { id: true, displayName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeEscalation(alertId: string, clinicianUserId: string, _notes?: string) {
    const recipient = await this.prisma.escalationRecipient.findFirst({
      where: { alertId, clinicianId: clinicianUserId },
    });
    if (!recipient) {
      throw new NotFoundException('You are not a registered recipient for this escalation');
    }

    const updatedRecipient = await this.prisma.escalationRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });

    await this.prisma.facilityEscalationAlert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED' },
    });

    await this.audit.record({
      actorId: clinicianUserId,
      action: 'ESCALATION_ACKNOWLEDGED',
      entityType: 'FacilityEscalationAlert',
      entityId: alertId,
      metadata: { recipientId: recipient.id },
    });

    return updatedRecipient;
  }

  async actionEscalation(alertId: string, clinicianUserId: string, actionTaken: string) {
    const alert = await this.prisma.facilityEscalationAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Escalation alert not found');

    const updated = await this.prisma.facilityEscalationAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACTIONED',
      },
    });

    await this.prisma.escalationRecipient.updateMany({
      where: { alertId, clinicianId: clinicianUserId },
      data: {
        status: 'ACTIONED',
        actionTaken,
        actionTakenAt: new Date(),
      },
    });

    await this.audit.record({
      actorId: clinicianUserId,
      action: 'ESCALATION_ACTIONED',
      entityType: 'FacilityEscalationAlert',
      entityId: alertId,
      metadata: { actionTaken },
    });

    return updated;
  }

  // ─── Facility-Level Notifications Inbox ───────────────────────────────────

  async getFacilityInbox(facilityId: string) {
    return this.prisma.notification.findMany({
      where: { audienceFacilityId: facilityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledgeFacilityNotification(notificationId: string, _userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { acknowledgedAt: new Date() },
    });
  }

  async actionFacilityNotification(notificationId: string, userId: string, actionTaken: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        actionTaken,
        actionTakenAt: new Date(),
        actionTakenById: userId,
      },
    });
  }
}
