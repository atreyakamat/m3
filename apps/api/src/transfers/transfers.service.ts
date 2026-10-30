import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canActorDecide,
  computeTransferStatus,
  TRANSFER_TERMINAL_STATUSES,
  type CreateContractorTransferInput,
  type CreateWorkerTransferInput,
  type Decision,
  type TransferActor,
  type TransferInitiator,
} from '@m3/shared';
import type { Prisma, SiteTransferRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

type TransferRow = SiteTransferRequest & {
  fromSite: { contractorId: string | null } | null;
  toSite: { contractorId: string | null };
};

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private decisionsOf(t: SiteTransferRequest) {
    return {
      worker: t.workerDecision as Decision,
      fromContractor: t.fromContractorDecision as Decision,
      toContractor: t.toContractorDecision as Decision,
    };
  }

  private async ensureNoPending(workerId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    const open = await client.siteTransferRequest.count({
      where: { workerId, status: { notIn: TRANSFER_TERMINAL_STATUSES } },
    });
    if (open > 0) {
      throw new ConflictException('This worker already has a pending transfer request');
    }
  }

  // ---- creation -----------------------------------------------------------

  async createWorkerTransfer(workerId: string, userId: string, input: CreateWorkerTransferInput) {
    const assignment = await this.prisma.workerSiteAssignment.findFirst({
      where: { workerId, active: true },
      include: { site: true },
    });
    if (!assignment) {
      throw new BadRequestException('You have no current site; select a site before requesting a transfer');
    }
    const toSite = await this.prisma.constructionSite.findUnique({ where: { siteCode: input.toSiteId } });
    if (!toSite) throw new NotFoundException('Destination site not found');
    if (toSite.id === assignment.siteId) {
      throw new BadRequestException('Destination site is the same as the current site');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureNoPending(workerId, tx);
      const decisions = { worker: 'APPROVED' as Decision, fromContractor: 'PENDING' as Decision, toContractor: 'PENDING' as Decision };
      const status = computeTransferStatus('WORKER', decisions);
      const created = await tx.siteTransferRequest.create({
        data: {
          workerId,
          fromSiteId: assignment.siteId,
          toSiteId: toSite.id,
          initiatorType: 'WORKER',
          initiatorId: userId,
          status,
          workerDecision: 'APPROVED',
          workerDecisionAt: new Date(),
          note: input.note ?? null,
        },
      });
      await this.audit.record({
        actorId: userId,
        action: 'TRANSFER_CREATED_BY_WORKER',
        entityType: 'SiteTransferRequest',
        entityId: created.id,
        metadata: { fromSiteId: assignment.siteId, toSiteId: toSite.id },
        tx,
      });
      return created;
    });
  }

  async createContractorTransfer(contractorId: string, input: CreateContractorTransferInput) {
    const worker = await this.prisma.worker.findUnique({ where: { workerCode: input.workerId } });
    if (!worker) throw new NotFoundException('No worker with that Worker ID');

    const toSite = await this.prisma.constructionSite.findUnique({ where: { siteCode: input.toSiteId } });
    if (!toSite) throw new NotFoundException('Destination site not found');
    // A contractor may only pull a worker to a site they manage (implicit destination approval).
    if (toSite.contractorId !== contractorId) {
      throw new ForbiddenException('You can only request transfers into sites you manage');
    }

    const assignment = await this.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker.id, active: true },
      include: { site: true },
    });
    if (assignment && assignment.siteId === toSite.id) {
      throw new BadRequestException('Worker is already assigned to this site');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureNoPending(worker.id, tx);
      const decisions = { worker: 'PENDING' as Decision, fromContractor: 'PENDING' as Decision, toContractor: 'APPROVED' as Decision };
      const status = computeTransferStatus('CONTRACTOR', decisions);
      const created = await tx.siteTransferRequest.create({
        data: {
          workerId: worker.id,
          fromSiteId: assignment?.siteId ?? null,
          toSiteId: toSite.id,
          initiatorType: 'CONTRACTOR',
          initiatorId: contractorId,
          status,
          toContractorDecision: 'APPROVED',
          toContractorDecisionAt: new Date(),
          note: input.note ?? null,
        },
      });
      await this.audit.record({
        actorId: contractorId,
        action: 'TRANSFER_CREATED_BY_CONTRACTOR',
        entityType: 'SiteTransferRequest',
        entityId: created.id,
        metadata: { workerId: worker.id, toSiteId: toSite.id },
        tx,
      });
      return created;
    });
  }

  // ---- decisions ----------------------------------------------------------

  /** Resolve which decision slot a contractor occupies for this transfer. */
  private contractorSlot(t: TransferRow, contractorId: string): TransferActor | null {
    if (t.fromSite?.contractorId === contractorId) return 'fromContractor';
    if (t.toSite.contractorId === contractorId) return 'toContractor';
    return null;
  }

  workerDecision(workerId: string, transferId: string, approve: boolean, reason?: string) {
    return this.applyDecision(transferId, approve, reason, (t) => {
      if (t.workerId !== workerId) throw new ForbiddenException('Not your transfer request');
      return { actor: 'worker', actorId: workerId };
    });
  }

  contractorDecision(contractorId: string, transferId: string, approve: boolean, reason?: string) {
    return this.applyDecision(transferId, approve, reason, (t) => {
      const slot = this.contractorSlot(t, contractorId);
      if (!slot) throw new ForbiddenException('You are not a contractor for this transfer');
      return { actor: slot, actorId: contractorId };
    });
  }

  /**
   * Record a decision and, if it completes the transfer, perform the
   * site-assignment switch — all inside ONE transaction that locks the
   * transfer row (SELECT ... FOR UPDATE). This serialises concurrent
   * approvals so the latest decision is always computed against committed
   * state, preventing lost updates and duplicate active assignments.
   */
  private async applyDecision(
    transferId: string,
    approve: boolean,
    reason: string | undefined,
    resolveActor: (t: TransferRow) => { actor: TransferActor; actorId: string },
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the row for the duration of the transaction.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "SiteTransferRequest" WHERE id = ${transferId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException('Transfer request not found');

      const t = (await tx.siteTransferRequest.findUnique({
        where: { id: transferId },
        include: { fromSite: { select: { contractorId: true } }, toSite: { select: { contractorId: true } } },
      })) as TransferRow;

      if (TRANSFER_TERMINAL_STATUSES.includes(t.status)) {
        throw new ConflictException('This transfer request is already closed');
      }

      const { actor, actorId } = resolveActor(t);
      const initiator = t.initiatorType as TransferInitiator;
      const decisions = this.decisionsOf(t);
      if (!canActorDecide(initiator, decisions, actor)) {
        throw new ForbiddenException('You cannot act on this transfer right now');
      }

      const value: Decision = approve ? 'APPROVED' : 'REJECTED';
      const nextStatus = computeTransferStatus(initiator, { ...decisions, [actor]: value });
      const now = new Date();

      const data: Prisma.SiteTransferRequestUpdateInput = { status: nextStatus };
      if (actor === 'worker') { data.workerDecision = value; data.workerDecisionAt = now; }
      if (actor === 'fromContractor') { data.fromContractorDecision = value; data.fromContractorDecisionAt = now; }
      if (actor === 'toContractor') { data.toContractorDecision = value; data.toContractorDecisionAt = now; }

      if (nextStatus === 'ACCEPTED') {
        // Close current active assignment, open the new one. The partial unique
        // index on (workerId) WHERE active is the final backstop.
        await tx.workerSiteAssignment.updateMany({
          where: { workerId: t.workerId, active: true },
          data: { active: false, endedAt: now },
        });
        await tx.workerSiteAssignment.create({
          data: { workerId: t.workerId, siteId: t.toSiteId, active: true, startedAt: now, transferId },
        });
        data.effectiveAt = now;
      }

      const updated = await tx.siteTransferRequest.update({ where: { id: transferId }, data });
      await this.audit.record({
        actorId,
        action:
          nextStatus === 'ACCEPTED'
            ? 'TRANSFER_COMPLETED'
            : approve
              ? 'TRANSFER_APPROVED'
              : 'TRANSFER_REJECTED',
        entityType: 'SiteTransferRequest',
        entityId: transferId,
        metadata: { actor, status: nextStatus, reason: reason ?? null },
        tx,
      });
      return updated;
    });
    return result;
  }

  async cancel(initiatorId: string, transferId: string, reason?: string) {
    const t = await this.prisma.siteTransferRequest.findUnique({ where: { id: transferId } });
    if (!t) throw new NotFoundException('Transfer request not found');
    if (TRANSFER_TERMINAL_STATUSES.includes(t.status)) {
      throw new ConflictException('This transfer request is already closed');
    }
    if (t.initiatorId !== initiatorId) {
      throw new ForbiddenException('Only the request initiator can cancel it');
    }
    const updated = await this.prisma.siteTransferRequest.update({
      where: { id: t.id },
      data: { status: 'CANCELLED', cancelledById: initiatorId, cancelledAt: new Date() },
    });
    await this.audit.record({
      actorId: initiatorId,
      action: 'TRANSFER_CANCELLED',
      entityType: 'SiteTransferRequest',
      entityId: t.id,
      metadata: { reason: reason ?? null },
    });
    return updated;
  }

  // ---- queries ------------------------------------------------------------

  listForWorker(workerId: string) {
    return this.prisma.siteTransferRequest.findMany({
      where: { workerId },
      include: { fromSite: true, toSite: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForContractorApproval(contractorId: string) {
    const rows = await this.prisma.siteTransferRequest.findMany({
      where: {
        status: { notIn: TRANSFER_TERMINAL_STATUSES },
        OR: [{ fromSite: { contractorId } }, { toSite: { contractorId } }],
      },
      include: { fromSite: { select: { contractorId: true } }, toSite: { select: { contractorId: true } }, worker: { select: { workerCode: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Keep only those where this contractor is a currently-actionable approver.
    return rows.filter((t) => {
      const slot = this.contractorSlot(t as TransferRow, contractorId);
      return slot ? canActorDecide(t.initiatorType as TransferInitiator, this.decisionsOf(t), slot) : false;
    });
  }
}
