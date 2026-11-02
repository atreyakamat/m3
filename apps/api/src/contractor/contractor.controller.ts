import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { ContractorService } from './contractor.service';

@ApiTags('contractor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CONTRACTOR')
@Controller({ path: 'contractor', version: '1' })
export class ContractorController {
  constructor(private readonly contractor: ContractorService) {}

  private contractorIdOf(u: RequestUser): string {
    if (!u.contractorId) throw new ForbiddenException('Not a contractor account');
    return u.contractorId;
  }

  @Get('profile')
  @ApiOperation({ summary: 'Contractor profile and assigned sites' })
  profile(@CurrentUser() user: RequestUser) {
    return this.contractor.getProfile(user.userId);
  }

  @Get('sites/:siteCode/stats')
  @ApiOperation({ summary: 'Aggregate malaria stats for the selected site' })
  stats(@CurrentUser() user: RequestUser, @Param('siteCode') siteCode: string) {
    return this.contractor.getSiteStats(this.contractorIdOf(user), siteCode);
  }

  @Get('sites/:siteCode/workers')
  @ApiOperation({ summary: 'Search and list workers at the selected site' })
  workers(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('malaria') malaria?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getSiteWorkers(this.contractorIdOf(user), siteCode, {
      search: search ?? q,
      malaria: malaria ?? status,
      page,
      pageSize,
    });
  }

  @Get('workers/:workerCode')
  @ApiOperation({ summary: 'Individual worker details for contractor view' })
  workerDetail(@CurrentUser() user: RequestUser, @Param('workerCode') workerCode: string) {
    return this.contractor.getWorkerDetail(this.contractorIdOf(user), workerCode);
  }

  @Get('sites/:siteCode/join-requests')
  @ApiOperation({ summary: 'Worker site join requests for the selected site' })
  joinRequests(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Query('status') status?: string,
  ) {
    return this.contractor.getSiteJoinRequests(this.contractorIdOf(user), siteCode, status);
  }

  @Get('sites/:siteCode/transfers')
  @ApiOperation({ summary: 'Worker transfers for the selected site' })
  transfers(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Query('status') status?: string,
  ) {
    return this.contractor.getSiteTransfers(this.contractorIdOf(user), siteCode, status);
  }

  @Get('sites/:siteCode/travels')
  @ApiOperation({ summary: 'Worker travel records and 7-day alert status' })
  travels(@CurrentUser() user: RequestUser, @Param('siteCode') siteCode: string) {
    return this.contractor.getSiteTravels(this.contractorIdOf(user), siteCode);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Contractor notifications' })
  notifications(
    @CurrentUser() user: RequestUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.contractor.getNotifications(
      this.contractorIdOf(user),
      user.userId,
      unreadOnly === 'true',
    );
  }

  @Post('notifications/:id/ack')
  @ApiOperation({ summary: 'Acknowledge contractor notification' })
  ackNotification(@Param('id') id: string) {
    return this.contractor.ackNotification(id);
  }
}
