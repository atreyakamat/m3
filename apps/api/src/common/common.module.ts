import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [AuditService, IdempotencyService],
  exports: [AuditService, IdempotencyService],
})
export class CommonModule {}
