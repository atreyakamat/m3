import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { AuthUser, Language, LoginInput, StaffLoginInput, WorkerRegisterInput } from '@m3/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import type { JwtPayload } from './jwt.strategy';

const WORKER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private generateWorkerCode(): string {
    let s = '';
    for (let i = 0; i < 6; i += 1) {
      s += WORKER_CODE_ALPHABET[Math.floor(Math.random() * WORKER_CODE_ALPHABET.length)];
    }
    return `M3-${s}`;
  }

  private async uniqueWorkerCode(): Promise<string> {
    // retry a handful of times on the astronomically unlikely collision
    for (let i = 0; i < 10; i += 1) {
      const code = this.generateWorkerCode();
      const existing = await this.prisma.worker.findUnique({ where: { workerCode: code } });
      if (!existing) return code;
    }
    return `M3-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }

  async phoneExists(phone: string): Promise<boolean> {
    const worker = await this.prisma.worker.findUnique({ where: { phone } });
    return Boolean(worker);
  }

  async registerWorker(input: WorkerRegisterInput): Promise<{ token: string; user: AuthUser }> {
    const existing = await this.prisma.worker.findUnique({ where: { phone: input.phone } });
    if (existing) {
      // Returning worker — do NOT create a duplicate record.
      throw new ConflictException('A worker with this phone number already exists. Please sign in.');
    }

    const pinHash = await bcrypt.hash(input.pin, 10);
    const workerCode = await this.uniqueWorkerCode();

    const worker = await this.prisma.worker.create({
      data: {
        workerCode,
        name: input.name,
        phone: input.phone,
        preferredLanguage: input.preferredLanguage as Language,
        user: {
          create: {
            role: 'WORKER',
            displayName: input.name,
            phone: input.phone,
            pinHash,
          },
        },
      },
      include: { user: true },
    });

    await this.audit.record({
      actorId: worker.user!.id,
      action: 'WORKER_REGISTERED',
      entityType: 'Worker',
      entityId: worker.id,
      metadata: { workerCode },
    });

    const user: AuthUser = {
      userId: worker.user!.id,
      role: 'WORKER',
      workerId: worker.id,
      contractorId: null,
      displayName: worker.name,
      preferredLanguage: worker.preferredLanguage,
    };
    return {
      token: this.signToken({ sub: user.userId, role: 'WORKER', workerId: worker.id, contractorId: null, name: worker.name }),
      user: { ...user, workerId: worker.workerCode }, // expose human Worker ID to clients
    };
  }

  async loginWorker(input: LoginInput): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.user.findFirst({
      where: { phone: input.phone, role: 'WORKER' },
      include: { worker: true },
    });
    if (!user || !user.pinHash || !user.worker) {
      throw new UnauthorizedException('Invalid phone number or PIN');
    }
    const ok = await bcrypt.compare(input.pin, user.pinHash);
    if (!ok) throw new UnauthorizedException('Invalid phone number or PIN');

    return {
      token: this.signToken({ sub: user.id, role: 'WORKER', workerId: user.worker.id, contractorId: null, name: user.displayName }),
      user: {
        userId: user.id,
        role: 'WORKER',
        workerId: user.worker.workerCode,
        contractorId: null,
        displayName: user.displayName,
        preferredLanguage: user.worker.preferredLanguage,
      },
    };
  }

  async staffLogin(input: StaffLoginInput): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !user.passwordHash || user.role === 'WORKER') {
      throw new UnauthorizedException('Invalid username or password');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid username or password');

    return {
      token: this.signToken({ sub: user.id, role: user.role, workerId: null, contractorId: user.contractorId, name: user.displayName }),
      user: {
        userId: user.id,
        role: user.role,
        workerId: null,
        contractorId: user.contractorId,
        displayName: user.displayName,
      },
    };
  }
}
