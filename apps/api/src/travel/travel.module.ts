/**
 * Positive-travel report foundation (spec §12).
 *
 * Records originate from the Contractor travel workflow: when a Worker with a
 * POSITIVE malaria status plans to travel outside Goa departing within seven
 * days, the contractor must submit exactly one report with a reason/comment.
 * Admin, Research Lab and Clinician are notified. Cancellation of the travel
 * keeps the report, notifies recipients and records the audit trail.
 */
import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [TravelController],
  providers: [TravelService],
})
export class TravelModule {}
