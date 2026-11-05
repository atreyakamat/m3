import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@m3/shared';
import type { RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  role: Role;
  workerId: string | null;
  contractorId: string | null;
  name: string;
  /** Set when the token must only be used for the mandatory credential change. */
  pendingCredentialChange?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { active: true },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('User account has been deactivated or revoked');
    }

    return {
      userId: payload.sub,
      role: payload.role,
      workerId: payload.workerId ?? null,
      contractorId: payload.contractorId ?? null,
      displayName: payload.name,
      pendingCredentialChange: payload.pendingCredentialChange ?? false,
    };
  }
}
