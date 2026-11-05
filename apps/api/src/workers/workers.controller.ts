import { Body, Controller, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Language } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import {
  createHouseholdMemberSchema,
  updateHouseholdMemberSchema,
  profileCorrectionSchema,
  appInstallConsentSchema,
  dataSubmissionConsentSchema,
} from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { WorkersService } from './workers.service';

class CreateHouseholdMemberDto extends createZodDto(createHouseholdMemberSchema) {}
class UpdateHouseholdMemberDto extends createZodDto(updateHouseholdMemberSchema) {}
class ProfileCorrectionDto extends createZodDto(profileCorrectionSchema) {}
class AppInstallConsentDto extends createZodDto(appInstallConsentSchema) {}
class DataSubmissionConsentDto extends createZodDto(dataSubmissionConsentSchema) {}

@ApiTags('workers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'workers', version: '1' })
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Get('me')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Get the signed-in worker profile, current site and derived malaria status' })
  async me(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.getProfile(user.workerId);
  }

  @Post('me/site')
  @Roles('WORKER')
  @ApiOperation({ summary: 'First-time construction-site selection (later changes use Transfer)' })
  async selectSite(@CurrentUser() user: RequestUser, @Body() body: { siteId: string }) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.assignInitialSite(user.workerId, body.siteId);
  }

  @Post('me/language')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Update worker preferred language' })
  async updateLanguage(
    @CurrentUser() user: RequestUser,
    @Body() body: { language: Language },
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.updatePreferredLanguage(user.workerId, body.language);
  }

  @Get('lookup/:workerCode')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Contractor: look up minimal worker details by Worker ID (transfer confirmation)' })
  async lookup(@Param('workerCode') workerCode: string) {
    return this.workers.lookupByCode(workerCode);
  }

  // ---- Family & Household Members -------------------------------------------

  @Get('me/household')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List household and family members of the worker' })
  async getHousehold(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.getHouseholdMembers(user.workerId);
  }

  @Post('me/household')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Add a household or family member' })
  async addHousehold(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateHouseholdMemberDto,
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.addHouseholdMember(user.workerId, dto);
  }

  @Put('me/household/:id')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Update a household member' })
  async updateHousehold(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdMemberDto,
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.updateHouseholdMember(user.workerId, id, dto);
  }

  // ---- Profile Demographic Correction Requests ------------------------------

  @Get('me/corrections')
  @Roles('WORKER')
  @ApiOperation({ summary: 'View worker demographic profile correction requests' })
  async getCorrections(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.listProfileCorrections(user.workerId);
  }

  @Post('me/corrections')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Submit request for demographic correction' })
  async requestCorrection(
    @CurrentUser() user: RequestUser,
    @Body() dto: ProfileCorrectionDto,
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.requestProfileCorrection(user.workerId, user.userId, dto);
  }

  // ---- Consent Tracking -----------------------------------------------------

  @Post('me/consent/install')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Record App Installation consent event' })
  async consentInstall(
    @CurrentUser() user: RequestUser,
    @Body() dto: AppInstallConsentDto,
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.recordInstallConsent(user.workerId, user.userId, dto);
  }

  @Post('me/consent/submission')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Record Data Submission consent event before screening' })
  async consentSubmission(
    @CurrentUser() user: RequestUser,
    @Body() dto: DataSubmissionConsentDto,
  ) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.recordSubmissionConsent(user.workerId, user.userId, dto);
  }

  // ---- Worker QR Pass (Spec §4, §6) -------------------------------------------

  @Post('me/pass/generate')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Generate a short-lived, single-use, cryptographically secure Worker QR Pass token' })
  async generatePass(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.generatePass(user.workerId);
  }

  @Get('me/pass/status')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Check current Worker QR Pass status, active token lifetime and pending requests' })
  async passStatus(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.getPassStatus(user.workerId);
  }

  @Post('me/pass/revoke')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Revoke any active Worker QR Pass token' })
  async revokePass(@CurrentUser() user: RequestUser) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.workers.revokePass(user.workerId);
  }
}
