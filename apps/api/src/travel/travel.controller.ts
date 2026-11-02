import { Body, Controller, ForbiddenException, Get, Post, UseGuards, ConflictException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { cancelTravelRecordSchema, submitTravelReportSchema } from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { TravelService } from './travel.service';

class SubmitTravelReportDto extends createZodDto(submitTravelReportSchema) {}
class CancelTravelRecordDto extends createZodDto(cancelTravelRecordSchema) {}

@ApiTags('travel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'travel', version: '1' })
export class TravelController {
  constructor(private readonly travel: TravelService) {}

  @Get('alerts/my-sites')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Flagged travels at the contractor sites (positive cases departing within 7 days)' })
  alerts(@CurrentUser() user: RequestUser) {
    if (!user.contractorId) throw new ForbiddenException('Not a contractor account');
    return this.travel.alertsForContractor(user.contractorId);
  }

  @Post('reports')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Submit the single mandatory travel report for a flagged travel case (comment required)' })
  submit(@CurrentUser() user: RequestUser, @Body() dto: SubmitTravelReportDto) {
    if (!user.contractorId) throw new ForbiddenException('Not a contractor account');
    return this.travel.submitReport(user.contractorId, user.userId, dto);
  }

  @Post('my-record/cancel')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker cancels a planned travel record (existing reports are preserved)' })
  cancel(@CurrentUser() user: RequestUser, @Body() body: { travelRecordId: string } & Partial<CancelTravelRecordDto>) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    if (!body?.travelRecordId) throw new ConflictException('travelRecordId is required');
    return this.travel.cancelTravelRecord(user.workerId, user.userId, body.travelRecordId, body.reason);
  }
}
