import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { HealthWorkerService } from './health-worker.service';
import {
  SelectActiveFacilityDto,
  HealthWorkerSearchQueryDto,
  SuspectedCaseDto,
  TestRequestDto,
  HealthWorkerFollowUpDto,
  HealthWorkerScreeningDto,
  HealthWorkerHouseholdScreeningDto,
} from './dto';

@ApiTags('health-worker')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HEALTH_WORKER)
@Controller({ path: 'health-worker', version: '1' })
export class HealthWorkerController {
  constructor(private readonly hwService: HealthWorkerService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get Health Worker profile, staff code, and assigned facilities' })
  getProfile(@CurrentUser() user: RequestUser) {
    return this.hwService.getProfile(user.userId);
  }

  @Post('active-facility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch active facility among authorized assignments' })
  setActiveFacility(
    @CurrentUser() user: RequestUser,
    @Body() dto: SelectActiveFacilityDto,
  ) {
    return this.hwService.setActiveFacility(user.userId, dto.facilityId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get facility-scoped dashboard surveillance statistics' })
  getDashboard(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.hwService.getDashboard(user.userId, facilityId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search workers and household members by name, code, phone, or QR pass' })
  search(
    @CurrentUser() user: RequestUser,
    @Query('q') q?: string,
    @Query('query') queryParam?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.hwService.search(user.userId, q || queryParam || '', facilityId);
  }

  @Get('workers/:id')
  @ApiOperation({ summary: 'Get complete clinical, screening, and travel details for a worker' })
  getWorker(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.hwService.getWorker(user.userId, id);
  }

  @Get('household-members/:id')
  @ApiOperation({ summary: 'Get household member details and assessment history' })
  getHouseholdMember(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.hwService.getHouseholdMember(user.userId, id);
  }

  @Post('screening')
  @ApiOperation({ summary: 'Record assisted worker initial screening with staff attribution' })
  recordScreening(
    @CurrentUser() user: RequestUser,
    @Body() dto: HealthWorkerScreeningDto,
  ) {
    return this.hwService.recordScreening(user.userId, dto);
  }

  @Post('household-screening')
  @ApiOperation({ summary: 'Record household member clinical screening/assessment' })
  recordHouseholdScreening(
    @CurrentUser() user: RequestUser,
    @Body() dto: HealthWorkerHouseholdScreeningDto,
  ) {
    return this.hwService.recordHouseholdScreening(user.userId, dto);
  }

  @Post('cases')
  @ApiOperation({ summary: 'Record suspected malaria case opening episode with status SUSPECTED' })
  recordSuspectedCase(
    @CurrentUser() user: RequestUser,
    @Body() dto: SuspectedCaseDto,
  ) {
    return this.hwService.recordSuspectedCase(user.userId, dto);
  }

  @Post('test-requests')
  @ApiOperation({ summary: 'Initiate RDT or Microscopy test request (laboratory referral)' })
  recordTestRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: TestRequestDto,
  ) {
    return this.hwService.recordTestRequest(user.userId, dto);
  }

  @Get('follow-ups')
  @ApiOperation({ summary: 'List pending follow-ups for workers associated with the facility' })
  listFollowUps(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hwService.listFollowUps(user.userId, facilityId);
  }

  @Post('follow-ups')
  @ApiOperation({ summary: 'Record follow-up visit outcome and referral attendance' })
  recordFollowUp(
    @CurrentUser() user: RequestUser,
    @Body() dto: HealthWorkerFollowUpDto,
  ) {
    return this.hwService.recordFollowUp(user.userId, dto);
  }

  @Get('travel-arrivals')
  @ApiOperation({ summary: 'List travel arrivals entering Goa requiring arrival screening' })
  listTravelArrivals(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hwService.listTravelArrivals(user.userId, facilityId);
  }

  @Get('symptom-reports')
  @ApiOperation({ summary: 'List symptom reports from workers in the facility surveillance area' })
  listSymptomReports(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId: string,
  ) {
    return this.hwService.listSymptomReports(user.userId, facilityId);
  }

  @Post('symptom-reports/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review and acknowledge a symptom report' })
  reviewSymptomReport(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { actionTaken: string },
  ) {
    return this.hwService.reviewSymptomReport(user.userId, id, body.actionTaken);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get facility notification inbox for active facility' })
  getFacilityInbox(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.hwService.getFacilityInbox(user.userId, facilityId);
  }

  @Post('inbox/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a facility notification' })
  acknowledgeNotification(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.hwService.acknowledgeNotification(user.userId, id);
  }

  @Post('inbox/:id/action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record action taken on a facility notification' })
  actionNotification(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { actionTaken: string },
  ) {
    return this.hwService.actionNotification(user.userId, id, body.actionTaken);
  }
}
