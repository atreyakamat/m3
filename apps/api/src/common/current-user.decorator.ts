import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@m3/shared';

export interface RequestUser {
  userId: string;
  role: Role;
  workerId: string | null;
  contractorId: string | null;
  displayName: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as RequestUser;
  },
);
