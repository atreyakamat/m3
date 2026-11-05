import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyParams {
  /** Audience by role (role-based inbox, e.g. every ADMIN sees it). */
  audienceRoles?: Role[];
  /** Audience by specific user ids. */
  audienceUserIds?: string[];
  /** Audience by facility id (facility inbox for PHC/UHC staff). */
  audienceFacilityIds?: string[];
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  /** Unique event key — duplicate notifications for the same event are skipped (spec §13). */
  dedupeKey: string;
  tx?: Prisma.TransactionClient;
}

/**
 * Role/user/facility-audience notifications with a global dedupe key. Never includes
 * sensitive personal or clinical data; `body` carries notification-level text only.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(params: NotifyParams): Promise<void> {
    const rows = [
      ...(params.audienceRoles ?? []).map((role) => ({
        audienceRole: role,
        audienceUserId: null,
        audienceFacilityId: null,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        // Unique per event AND audience so one event fans out once per recipient
        // while replays of the same event stay deduplicated (spec §13).
        dedupeKey: `${params.dedupeKey}:role:${role}`,
      })),
      ...(params.audienceUserIds ?? []).map((userId) => ({
        audienceRole: null,
        audienceUserId: userId,
        audienceFacilityId: null,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        dedupeKey: `${params.dedupeKey}:user:${userId}`,
      })),
      ...(params.audienceFacilityIds ?? []).map((facilityId) => ({
        audienceRole: null,
        audienceUserId: null,
        audienceFacilityId: facilityId,
        type: params.type,
        title: params.title,
        body: params.body,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        dedupeKey: `${params.dedupeKey}:facility:${facilityId}`,
      })),
    ];
    if (rows.length === 0) return;
    try {
      const client = params.tx ?? this.prisma;
      // dedupeKey has a unique index; createMany with skipDuplicates makes
      // the whole call idempotent per event.
      await client.notification.createMany({ data: rows, skipDuplicates: true });
    } catch (e) {
      // Notifications must never break the underlying business operation.
      this.logger.warn(`notification "${params.dedupeKey}" not delivered: ${String(e)}`);
    }
  }
}
