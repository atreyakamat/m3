import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { AuthUser, Language, LoginInput, StaffLoginInput, WorkerRegisterInput } from '@m3/shared';
import { adminPasswordSchema, pinSchema } from '@m3/shared';
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
      phone: worker.phone,
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
    if (!user.active) {
      throw new ForbiddenException('This account has been deactivated by the administrator');
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
        phone: user.worker.phone,
        preferredLanguage: user.worker.preferredLanguage,
      },
    };
  }

  async loginAny(input: LoginInput): Promise<{ token: string; user: AuthUser }> {
    const identifier = input.phone.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone: identifier }, { username: identifier }],
      },
      include: { worker: true, contractor: true },
    });
    if (!user) throw new UnauthorizedException('Invalid phone number or PIN');
    if (!user.active) {
      throw new ForbiddenException('This account has been deactivated by the administrator');
    }

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts can only access the M3 web portal.');
    }

    if (user.role === 'WORKER') {
      if (!user.pinHash || !user.worker) throw new UnauthorizedException('Invalid phone number or PIN');
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
          phone: user.worker.phone,
          preferredLanguage: user.worker.preferredLanguage,
        },
      };
    }

    // Contractor or other staff account
    if (!user.passwordHash) throw new UnauthorizedException('Invalid phone number or PIN');
    const ok = await bcrypt.compare(input.pin, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid phone number or PIN');

    const pending = user.mustChangeCredential;
    const token = this.signToken({
      sub: user.id,
      role: user.role,
      workerId: null,
      contractorId: user.contractorId,
      name: user.displayName,
      ...(pending ? { pendingCredentialChange: true } : {}),
    });
    return {
      token,
      role: user.role,
      credentialChangeRequired: pending ? true : undefined,
      user: {
        userId: user.id,
        role: user.role,
        workerId: null,
        contractorId: user.contractorId,
        displayName: user.displayName,
        ...(pending ? { credentialChangeRequired: true } : {}),
      },
    } as any;
  }

  async staffLogin(input: StaffLoginInput): Promise<{ token: string; user: AuthUser }> {
    const identifier = input.username.trim();
    // Identifier may be a provisioned username OR the account's registered
    // phone number (Admin-created stakeholders log in with phone + temp PIN).
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, ...(identifier.length === 10 ? [{ phone: identifier }] : [])],
      },
      include: { contractor: true, worker: true },
    });
    if (user && user.role === 'WORKER') {
      throw new ForbiddenException('Worker accounts can only access the M3 mobile app.');
    }
    if (user && user.role === 'CONTRACTOR') {
      throw new ForbiddenException('Contractor accounts can only access the M3 mobile app.');
    }
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid username or password');
    if (!user.active) {
      throw new ForbiddenException('This account has been deactivated by the administrator');
    }

    const pending = user.mustChangeCredential;
    const token = this.signToken({
      sub: user.id,
      role: user.role,
      workerId: null,
      contractorId: user.contractorId,
      name: user.displayName,
      ...(pending ? { pendingCredentialChange: true } : {}),
    });
    return {
      token,
      role: user.role,
      credentialChangeRequired: pending ? true : undefined,
      user: {
        userId: user.id,
        role: user.role,
        workerId: null,
        contractorId: user.contractorId,
        displayName: user.displayName,
        ...(pending ? { credentialChangeRequired: true } : {}),
      },
    } as any;
  }

  /**
   * Mandatory first-login credential change (spec §8).
   * Strength rules are role-based: ADMIN sets a strong password, all other
   * admin-provisioned stakeholders set a 4–6 digit PIN. Never stores or
   * returns plaintext credentials.
   */
  async changeCredential(
    userId: string,
    input: { newCredential: string; confirmCredential: string },
  ): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credential change request');
    }
    if (user.role === 'WORKER') {
      throw new BadRequestException('Workers manage their PIN through the worker app');
    }
    if (input.newCredential !== input.confirmCredential) {
      throw new BadRequestException('New credential and confirmation do not match');
    }

    const credential =
      user.role === 'ADMIN'
        ? (adminPasswordSchema.safeParse(input.newCredential) as { success: boolean; error?: { issues: { message: string }[] } })
        : (pinSchema.safeParse(input.newCredential) as { success: boolean; error?: { issues: { message: string }[] } });
    if (!credential.success) {
      throw new BadRequestException(credential.error?.issues[0]?.message ?? 'Credential does not meet the strength requirements');
    }

    const passwordHash = await bcrypt.hash(input.newCredential, 10);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangeCredential: false },
      });
      await this.audit.record({
        actorId: user.id,
        action: user.role === 'ADMIN' ? 'ADMIN_PASSWORD_CHANGED' : 'STAKEHOLDER_PIN_CHANGED',
        entityType: 'User',
        entityId: user.id,
        tx,
      });
      return u;
    });

    const token = this.signToken({
      sub: updated.id,
      role: updated.role,
      workerId: null,
      contractorId: updated.contractorId,
      name: updated.displayName,
    });
    return {
      token,
      user: {
        userId: updated.id,
        role: updated.role,
        workerId: null,
        contractorId: updated.contractorId,
        displayName: updated.displayName,
      },
    };
  }
}
