import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Role } from '@m3/shared';
import type { RequestUser } from '../common/current-user.decorator';

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
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret')!,
    });
  }

  validate(payload: JwtPayload): RequestUser {
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
