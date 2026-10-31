import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  diagnosticResultSchema,
  followUpResponseSchema,
  symptomReportSchema,
  travelRecordSchema,
} from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { RecordsService } from './records.service';

class SymptomReportDto extends createZodDto(symptomReportSchema) {}
class FollowUpResponseDto extends createZodDto(followUpResponseSchema) {}
class DiagnosticResultDto extends createZodDto(diagnosticResultSchema) {}
class TravelRecordDto extends createZodDto(travelRecordSchema) {}

@ApiTags('records')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'records', version: '1' })
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  private workerIdOf(user: RequestUser): string {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return user.workerId;
  }

  @Get('me/episodes')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List the worker malaria episodes with diagnostics' })
  episodes(@CurrentUser() u: RequestUser) {
    return this.records.listEpisodes(this.workerIdOf(u));
  }

  @Get('me/diagnostics')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List authorized diagnostic results the worker may view' })
  diagnostics(@CurrentUser() u: RequestUser) {
    return this.records.listDiagnostics(this.workerIdOf(u));
  }

  @Get('me/prescriptions/current')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Current prescription (opened by default)' })
  currentPrescription(@CurrentUser() u: RequestUser) {
    return this.records.currentPrescription(this.workerIdOf(u));
  }

  @Get('me/prescriptions/history')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Full prescription history (never overwritten)' })
  prescriptionHistory(@CurrentUser() u: RequestUser) {
    return this.records.prescriptionHistory(this.workerIdOf(u));
  }

  @Get('me/follow-ups')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List follow-up check-ins for the worker' })
  followUps(@CurrentUser() u: RequestUser) {
    return this.records.listFollowUps(this.workerIdOf(u));
  }

  @Get('me/travel')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List travel records for the worker' })
  travel(@CurrentUser() u: RequestUser) {
    return this.records.listTravelRecords(this.workerIdOf(u));
  }

  @Post('me/travel')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Submit a new travel record' })
  submitTravel(@CurrentUser() u: RequestUser, @Body() dto: TravelRecordDto) {
    return this.records.submitTravelRecord(this.workerIdOf(u), u.userId, dto);
  }

  @Post('me/symptom-reports')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Submit a "Feeling unwell" symptom report (never a diagnosis)' })
  symptom(@CurrentUser() u: RequestUser, @Body() dto: SymptomReportDto) {
    return this.records.submitSymptomReport(this.workerIdOf(u), u.userId, dto);
  }

  @Post('me/follow-ups/respond')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Respond to a follow-up check-in' })
  respond(@CurrentUser() u: RequestUser, @Body() dto: FollowUpResponseDto) {
    return this.records.respondFollowUp(this.workerIdOf(u), dto);
  }

  // Authorized clinical writes — workers can never reach these.
  @Post('episodes')
  @Roles('CLINICIAN', 'HEALTH_WORKER')
  @ApiOperation({ summary: 'Open a malaria episode for a worker (clinician/health worker)' })
  createEpisode(@Body() body: { workerId: string; onsetDate?: string }) {
    return this.records.createEpisode(body.workerId, body.onsetDate);
  }

  @Post('diagnostics')
  @Roles('CLINICIAN', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Record an authorized diagnostic result (clinician/pathologist only)' })
  createDiagnostic(@CurrentUser() u: RequestUser, @Body() dto: DiagnosticResultDto) {
    return this.records.createDiagnostic(u.userId, dto);
  }

  @Post('prescriptions')
  @Roles('CLINICIAN')
  @ApiOperation({ summary: 'Issue a prescription (clinician only; append-only)' })
  createPrescription(@CurrentUser() u: RequestUser, @Body() body: { episodeId: string; details: string }) {
    return this.records.createPrescription(u.userId, body);
  }
}
