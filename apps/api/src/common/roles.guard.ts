import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@m3/shared';
import { ROLES_KEY } from './roles.decorator';
import type { RequestUser } from './current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
