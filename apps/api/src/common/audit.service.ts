import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/** Records audit events for sensitive changes (never logs PINs/tokens/PHI). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const client = params.tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? {},
      },
    });
  }
}
