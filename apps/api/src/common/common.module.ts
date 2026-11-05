import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';
import { NotificationService } from './notification.service';
import { TranslationService } from './translation.service';

@Global()
@Module({
  providers: [AuditService, IdempotencyService, NotificationService, TranslationService],
  exports: [AuditService, IdempotencyService, NotificationService, TranslationService],
})
export class CommonModule {}
