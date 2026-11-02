/**
 * Worker → construction-site joining requests (spec §10).
 *
 * Approval belongs exclusively to the destination-site Contractor; Admin only
 * observes and receives decision notifications. Admin has no endpoint here
 * that could bypass the required Contractor approval.
 */
import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
