import { SetMetadata } from '@nestjs/common';

/**
 * Marks an endpoint as reachable while the caller still holds a temporary
 * credential (first-login PIN/password change). Every other protected
 * endpoint rejects pending tokens, so users cannot read any dashboard data
 * before completing the mandatory credential change (spec §8).
 */
export const ALLOW_PENDING_CREDENTIAL = 'allowPendingCredential';
export const AllowPendingCredential = () => SetMetadata(ALLOW_PENDING_CREDENTIAL, true);
