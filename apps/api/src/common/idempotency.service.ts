import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Idempotency for retry-safe create endpoints: the same client key within a
 * scope returns the originally created entity id instead of duplicating.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async lookup(scope: string, key: string): Promise<string | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { scope_key: { scope, key } },
    });
    return row?.entityId ?? null;
  }

  async record(scope: string, key: string, userId: string | null, entityId: string): Promise<void> {
    await this.prisma.idempotencyKey.create({ data: { scope, key, userId, entityId } });
  }
}
