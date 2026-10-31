import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Language } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { WorkersService } from './workers.service';

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
}
