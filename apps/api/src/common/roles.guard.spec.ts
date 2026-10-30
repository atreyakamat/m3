import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@m3/shared';
import { RolesGuard } from './roles.guard';

function ctxFor(user: unknown, required: Role[] | undefined) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
  const guard = new RolesGuard(reflector);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as any;
  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const { guard, context } = ctxFor({ role: 'WORKER' }, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a matching role', () => {
    const { guard, context } = ctxFor({ role: 'CONTRACTOR' }, ['CONTRACTOR']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('forbids a non-matching role', () => {
    const { guard, context } = ctxFor({ role: 'WORKER' }, ['CONTRACTOR']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('forbids when there is no user', () => {
    const { guard, context } = ctxFor(undefined, ['WORKER']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
