import {
  Body,
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

  @Get('dashboard')
  @ApiOperation({ summary: 'Contractor dashboard aggregate data, summary cards, and activity feed' })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.contractor.getDashboard(this.contractorIdOf(user), user.userId);
  }

  @Get('sites')
  @ApiOperation({ summary: 'List all construction sites assigned to the contractor with optional search' })
  sites(@CurrentUser() user: RequestUser, @Query('search') search?: string, @Query('q') q?: string) {
    return this.contractor.getContractorSitesList(this.contractorIdOf(user), search ?? q);
  }

  @Get('sites/:siteCode/stats')
  @ApiOperation({ summary: 'Aggregate malaria stats for the selected site' })
  stats(@CurrentUser() user: RequestUser, @Param('siteCode') siteCode: string) {
    return this.contractor.getSiteStats(this.contractorIdOf(user), siteCode);
  }

  @Get('sites/:siteCode/detail')
  @ApiOperation({ summary: 'Detailed view of a construction site assigned to the contractor' })
  siteDetail(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getContractorSiteDetail(this.contractorIdOf(user), siteCode, {
      search: search ?? q,
      status,
      page,
      pageSize,
    });
  }

  @Post('sites/:siteCode/assign-worker')
  @ApiOperation({ summary: 'Directly assign an unassigned worker to this construction site' })
  assignWorker(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Body() body: { workerCode: string; note?: string },
  ) {
    return this.contractor.assignWorkerToSite(this.contractorIdOf(user), siteCode, body);
  }

  @Post('sites/:siteCode/workers/:workerCode/end-assignment')
  @ApiOperation({ summary: 'End an active worker assignment at this construction site' })
  endAssignment(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Param('workerCode') workerCode: string,
    @Body() body?: { reason?: string },
  ) {
    return this.contractor.endWorkerAssignment(
      this.contractorIdOf(user),
      siteCode,
      workerCode,
      body,
    );
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
    @Query('assignmentStatus') assignmentStatus?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getSiteWorkers(this.contractorIdOf(user), siteCode, {
      search: search ?? q,
      malaria,
      status: assignmentStatus ?? status,
      assignmentStatus: assignmentStatus ?? status,
      page,
      pageSize,
    });
  }

  @Get('workers')
  @ApiOperation({ summary: 'Search and list all workers assigned to this contractor across all sites' })
  contractorWorkers(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('siteCode') siteCode?: string,
    @Query('assignmentStatus') assignmentStatus?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getContractorWorkers(this.contractorIdOf(user), {
      search: search ?? q,
      siteCode,
      assignmentStatus: assignmentStatus ?? status,
      status: assignmentStatus ?? status,
      page,
      pageSize,
    });
  }

  @Get('workers/check-phone')
  @ApiOperation({ summary: 'Check if a worker phone is already registered (Add Worker workflow)' })
  checkPhone(@Query('phone') phone: string) {
    return this.contractor.checkWorkerPhone(phone ?? '');
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

  // ---- Worker QR Pass Scanning & Assignment Requests (Spec §5, §6, §7) --------

  @Post('pass/scan')
  @ApiOperation({ summary: 'Scan a Worker QR Pass token and return identity confirmation details' })
  scanPass(@CurrentUser() user: RequestUser, @Body() body: { token: string }) {
    return this.contractor.scanWorkerPass(this.contractorIdOf(user), body?.token ?? '');
  }

  @Post('pass/request')
  @ApiOperation({ summary: 'Submit an assignment or transfer request via scanned Worker QR Pass token' })
  requestAssignment(
    @CurrentUser() user: RequestUser,
    @Body() body: { token: string; siteCode: string; note?: string },
  ) {
    return this.contractor.requestWorkerAssignment(this.contractorIdOf(user), user.userId, body);
  }

  // ---- Iteration 3: Transfer Management Endpoints -----------------------------

  @Get('transfers')
  @ApiOperation({ summary: 'List transfer requests relevant to the authenticated contractor' })
  contractorTransfers(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getContractorTransfers(this.contractorIdOf(user), {
      status,
      search,
      page,
      pageSize,
    });
  }

  @Get('transfers/:id')
  @ApiOperation({ summary: 'Get details and complete timeline history for a specific transfer' })
  contractorTransferDetail(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contractor.getContractorTransferDetail(this.contractorIdOf(user), id);
  }

  @Post('transfers/:id/approve')
  @ApiOperation({ summary: 'Approve destination transfer request' })
  approveTransfer(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.contractor.approveContractorTransfer(this.contractorIdOf(user), id, body?.reason);
  }

  @Post('transfers/:id/reject')
  @ApiOperation({ summary: 'Reject destination transfer request or release' })
  rejectTransfer(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.contractor.rejectContractorTransfer(this.contractorIdOf(user), id, body?.reason);
  }

  @Post('transfers/:id/release')
  @ApiOperation({ summary: 'Current contractor releases worker to destination site' })
  releaseWorker(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.contractor.releaseContractorWorker(this.contractorIdOf(user), id, body?.reason);
  }

  @Post('transfers/:id/cancel')
  @ApiOperation({ summary: 'Initiator cancels a pending transfer request' })
  cancelTransfer(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.contractor.cancelContractorTransfer(this.contractorIdOf(user), id, body?.reason);
  }

  @Post('transfers/initiate')
  @ApiOperation({ summary: 'Contractor initiates a transfer by Worker ID into one of their sites' })
  initiateTransfer(
    @CurrentUser() user: RequestUser,
    @Body() body: { workerId: string; toSiteId: string; note?: string },
  ) {
    return this.contractor.initiateContractorTransfer(this.contractorIdOf(user), body);
  }

  // ---- Iteration 5: Worker Activity Timeline & Operational Alerts --------------

  @Get('alerts')
  @ApiOperation({ summary: 'Contractor operational alerts with status/category filtering and health coordination' })
  getAlerts(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getContractorAlerts(this.contractorIdOf(user), user.userId, {
      status,
      category,
      page,
      pageSize,
    });
  }

  @Post('alerts/:id/read')
  @ApiOperation({ summary: 'Mark an operational alert as read' })
  readAlert(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.contractor.ackContractorAlert(this.contractorIdOf(user), user.userId, id);
  }

  @Post('alerts/read-all')
  @ApiOperation({ summary: 'Mark all contractor alerts as read' })
  readAllAlerts(
    @CurrentUser() user: RequestUser,
  ) {
    return this.contractor.ackAllContractorAlerts(this.contractorIdOf(user), user.userId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Worker activity timeline for contractor sites and workforce' })
  getActivity(
    @CurrentUser() user: RequestUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('eventType') eventType?: string,
    @Query('siteCode') siteCode?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.contractor.getContractorActivity(this.contractorIdOf(user), {
      startDate,
      endDate,
      from,
      to,
      type,
      eventType,
      siteCode,
      search,
      page,
      pageSize,
    });
  }
}
