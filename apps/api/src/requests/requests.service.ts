import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role as PrismaRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationService } from '../common/notification.service';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
  ) {}

  /** Worker raises a join request (only when they have no active site yet). */
  async createJoinRequest(workerId: string, userId: string, siteRef: string) {
    const site = await this.prisma.constructionSite.findFirst({
      where: { OR: [{ siteCode: siteRef }, { id: siteRef }], active: true },
    });
    if (!site) throw new NotFoundException('Site not found or inactive');

    const active = await this.prisma.workerSiteAssignment.findFirst({ where: { workerId, active: true } });
    if (active) {
      throw new BadRequestException(
        'You already have a site; change it through the Transfer flow instead',
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Explicit open-request check in the same transaction; the partial
        // unique index in migration SQL is the race backstop.
        const open = await tx.siteJoinRequest.findFirst({ where: { workerId, status: 'PENDING' } });
        if (open) throw new ConflictException('You already have a pending join request');
        const request = await tx.siteJoinRequest.create({
          data: { workerId, siteId: site.id, status: 'PENDING' },
        });
        await this.audit.record({
          actorId: userId,
          action: 'JOIN_REQUEST_CREATED',
          entityType: 'SiteJoinRequest',
          entityId: request.id,
          metadata: { workerId, siteId: site.id },
          tx,
        });
        return request;
      });
      return { joinRequestId: created.id, status: created.status };
    } catch (e) {
      throw this.translateUniqueError(e);
    }
  }

  /** Contractor of the requested site accepts or declines (spec §10 flow). */
  async contractorDecision(contractorId: string, requestId: string, approve: boolean, actorUserId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = (await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SiteJoinRequest" WHERE id = ${requestId} FOR UPDATE`) as Array<{ id: string }>;
      if (locked.length === 0) throw new NotFoundException('Join request not found');

      const request = await tx.siteJoinRequest.findUnique({
        where: { id: requestId },
        include: { site: true, worker: true },
      });
      if (!request) throw new NotFoundException('Join request not found');
      // Authority is checked first: only the assigned Contractor of the site
      // may even attempt a decision; status is validated after.
      if (request.site.contractorId !== contractorId) {
        throw new ForbiddenException('Only the assigned Contractor of the site can decide this request');
      }
      if (request.status !== 'PENDING') {
        throw new ConflictException('This join request has already been decided');
      }
      if (!request.site.active) {
        throw new BadRequestException('The requested site is inactive');
      }

      const now = new Date();
      const status = approve ? 'ACCEPTED' : 'DECLINED';

      if (approve) {
        // Only after Contractor approval is the site assignment created —
        // never before (partial unique index is the backstop for races).
        await tx.workerSiteAssignment.create({
          data: { workerId: request.workerId, siteId: request.siteId, active: true },
        });
      }

      const updated = await tx.siteJoinRequest.update({
        where: { id: requestId },
        data: { status, decidedById: actorUserId, decidedAt: now },
      });

      await this.audit.record({
        actorId: actorUserId,
        action: approve ? 'JOIN_REQUEST_ACCEPTED' : 'JOIN_REQUEST_DECLINED',
        entityType: 'SiteJoinRequest',
        entityId: requestId,
        metadata: { contractorId, workerId: request.workerId, siteId: request.siteId },
        tx,
      });
      await this.notify.notify({
        audienceRoles: ['ADMIN'] as PrismaRole[],
        type: approve ? 'JOIN_REQUEST_ACCEPTED' : 'JOIN_REQUEST_DECLINED',
        title: approve ? 'Join request accepted' : 'Join request declined',
        body: `Worker ${request.worker.workerCode} join request for site ${request.site.siteCode} was ${status.toLowerCase()} by the Contractor.`,
        entityType: 'SiteJoinRequest',
        entityId: requestId,
        dedupeKey: `join_decision:${requestId}`,
        tx,
      });
      return updated;
    });
    return { joinRequestId: result.id, status: result.status };
  }

  /** Worker withdraws their own pending request. */
  async cancel(workerId: string, userId: string, requestId: string) {
    const request = await this.prisma.siteJoinRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.workerId !== workerId) throw new ForbiddenException('Not your join request');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Only pending join requests can be cancelled');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.audit.record({
        actorId: userId,
        action: 'JOIN_REQUEST_CANCELLED',
        entityType: 'SiteJoinRequest',
        entityId: requestId,
        metadata: { workerId },
        tx,
      });
      return tx.siteJoinRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' },
      });
    });
    return { joinRequestId: updated.id, status: updated.status };
  }

  private translateUniqueError(e: unknown): Error {
    const code = (e as { code?: string })?.code;
    const msg = String(e);
    if (code === 'P2002' || msg.includes('one_pending_join_request_per_worker')) {
      return new ConflictException('You already have a pending join request');
    }
    if (msg.includes('WorkerSiteAssignment_workerId_key')) {
      return new ConflictException('Worker already has an active site assignment');
    }
    return e as Error;
  }
}
