import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { RequestUser } from '../common/current-user.decorator';
import { ALLOW_PENDING_CREDENTIAL } from '../common/allow-pending-credential.decorator';

/**
 * Standard JWT guard. Additionally enforces the mandatory first-login
 * credential change: any account still holding a temporary credential gets
 * tokens that resolve to `pendingCredentialChange: true`, and this guard
 * rejects them on every endpoint not explicitly marked with
 * {@link AllowPendingCredential} (spec §8 — backend-enforced, not just a
 * frontend redirect).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  override handleRequest<TUser = any>(
    err: unknown,
    user: unknown,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const resolved = super.handleRequest(err, user, info, context, status) as RequestUser;
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_CREDENTIAL, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed && resolved?.pendingCredentialChange) {
      throw new ForbiddenException(
        'You must complete the mandatory credential change before accessing the platform',
      );
    }
    return resolved as TUser;
  }
}
