import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, NotificationService],
  exports: [AuditService, IdempotencyService, NotificationService],
})
export class CommonModule {}
