import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { AdminService } from './admin.service';
import {
  CreateAdminSiteDto,
  CreateAdminUserDto,
  DeactivateAdminSiteDto,
  ResetAdminUserPinDto,
  TravelReportReviewDto,
  UpdateAdminSiteDto,
  ReviewCorrectionDto,
} from './dto';

/**
 * Admin-only management API. Every route requires an authenticated account
 * with the ADMIN role (JWT + RBAC enforced here on the backend, spec §14).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ---- overview -------------------------------------------------------------

  @Get('overview')
  @ApiOperation({ summary: 'Platform-level statistics for the Admin overview dashboard' })
  overview() {
    return this.admin.overview();
  }

  // ---- construction sites ----------------------------------------------------

  @Get('locations/tree')
  @ApiOperation({ summary: 'Hierarchical location tree (State -> District -> Taluka -> Village/Town)' })
  locationTree() {
    return this.admin.locationTree();
  }

  @Get('locations')
  @ApiOperation({ summary: 'Area options (with district/taluka parents) for site forms' })
  locations() {
    return this.admin.locationOptions();
  }

  @Get('sites')
  @ApiOperation({ summary: 'Searchable, filterable construction-site list' })
  listSites(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listSites({ search, status, page, pageSize });
  }

  @Post('sites')
  @ApiOperation({ summary: 'Create a construction site (site ID auto-generated)' })
  createSite(@CurrentUser() user: RequestUser, @Body() dto: CreateAdminSiteDto) {
    return this.admin.createSite(user.userId, dto);
  }

  @Get('sites/:siteCode')
  @ApiOperation({ summary: 'Construction-site detail with contractor and linked workers' })
  siteDetail(@Param('siteCode') siteCode: string) {
    return this.admin.siteDetail(siteCode);
  }

  @Put('sites/:siteCode')
  @ApiOperation({ summary: 'Update a construction site (site ID cannot change)' })
  updateSite(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Body() dto: UpdateAdminSiteDto,
  ) {
    return this.admin.updateSite(user.userId, siteCode, dto);
  }

  @Post('sites/:siteCode/deactivate')
  @ApiOperation({ summary: 'Deactivate a construction site (permanent deletion is not offered)' })
  deactivateSite(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Body() dto: DeactivateAdminSiteDto,
  ) {
    return this.admin.deactivateSite(user.userId, siteCode, dto.confirm);
  }

  // ---- Multiple Contractor Site Management (Spec §3, §8) -----------------------

  @Get('sites/:siteCode/contractors')
  @ApiOperation({ summary: 'List all contractors actively assigned to a site' })
  siteContractors(@Param('siteCode') siteCode: string) {
    return this.admin.getSiteContractors(siteCode);
  }

  @Post('sites/:siteCode/contractors')
  @ApiOperation({ summary: 'Add a contractor to a construction site' })
  addSiteContractor(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Body() dto: { contractorId: string },
  ) {
    return this.admin.addContractorToSite(user.userId, siteCode, dto.contractorId);
  }

  @Delete('sites/:siteCode/contractors/:contractorId')
  @ApiOperation({ summary: 'Safely remove a contractor from a construction site (guards active workers)' })
  removeSiteContractor(
    @CurrentUser() user: RequestUser,
    @Param('siteCode') siteCode: string,
    @Param('contractorId') contractorId: string,
    @Query('reassignTo') reassignTo?: string,
    @Body() body?: { reassignToContractorId?: string },
  ) {
    return this.admin.removeContractorFromSite(
      user.userId,
      siteCode,
      contractorId,
      body?.reassignToContractorId ?? reassignTo,
    );
  }

  @Get('sites/:siteCode/assignment-history')
  @ApiOperation({ summary: 'View workforce assignment history for a construction site' })
  siteAssignmentHistory(@Param('siteCode') siteCode: string) {
    return this.admin.getSiteAssignmentHistory(siteCode);
  }

  // ---- user management ---------------------------------------------------------

  @Get('users')
  @ApiOperation({ summary: 'Searchable, role-filtered non-worker account list' })
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listUsers({ search, role, page, pageSize });
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a non-worker account with a generated unique role-scoped ID and temporary PIN' })
  createUser(@CurrentUser() user: RequestUser, @Body() dto: CreateAdminUserDto) {
    return this.admin.createUser(user.userId, dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Account detail with status and first-login state' })
  userDetail(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Post('users/:id/activate')
  @ApiOperation({ summary: 'Activate an account' })
  activate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setUserActive(user.userId, id, true);
  }

  @Post('users/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate an account (records retained; no hard delete)' })
  deactivate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.setUserActive(user.userId, id, false);
  }

  @Post('users/:id/reset-pin')
  @ApiOperation({ summary: 'Reset an account to a new temporary PIN (forces first-login change again)' })
  resetPin(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: ResetAdminUserPinDto) {
    return this.admin.resetUserPin(user.userId, id, dto);
  }

  // ---- workers -----------------------------------------------------------------

  @Get('workers')
  @ApiOperation({ summary: 'Searchable worker list with site/screening/malaria filters' })
  listWorkers(
    @Query('search') search?: string,
    @Query('siteCode') siteCode?: string,
    @Query('screening') screening?: string,
    @Query('malaria') malaria?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listWorkers({ search, siteCode, screening, malaria, page, pageSize });
  }

  @Get('workers/:workerCode')
  @ApiOperation({ summary: 'Worker record: profile, assignment history and surveillance info (read-only)' })
  workerDetail(@Param('workerCode') workerCode: string) {
    return this.admin.workerDetail(workerCode);
  }

  @Post('workers/:workerCode/remove')
  @ApiOperation({ summary: 'Admin safely removes/deactivates a worker from the active system while preserving surveillance records' })
  removeWorker(
    @CurrentUser() user: RequestUser,
    @Param('workerCode') workerCode: string,
    @Body() body: { confirm: boolean; reason?: string },
  ) {
    return this.admin.removeWorker(user.userId, workerCode, body);
  }

  @Put('workers/:workerCode')
  @ApiOperation({ summary: 'Admin corrects worker registered name or phone (audit-recorded correction process)' })
  updateWorker(
    @CurrentUser() user: RequestUser,
    @Param('workerCode') workerCode: string,
    @Body() body: { name?: string; phone?: string },
  ) {
    return this.admin.updateWorker(user.userId, workerCode, body);
  }

  // ---- worker join requests -------------------------------------------------------

  @Get('requests')
  @ApiOperation({ summary: 'Worker join-request list (decisions remain with the site Contractor)' })
  listRequests(
    @Query('status') status?: string,
    @Query('siteCode') siteCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listJoinRequests({ status, siteCode, page, pageSize });
  }

  // ---- transfers ------------------------------------------------------------------

  @Get('transfers')
  @ApiOperation({ summary: 'Transfer-request list with approval states' })
  listTransfers(
    @Query('status') status?: string,
    @Query('siteCode') siteCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listTransfers({ status, siteCode, page, pageSize });
  }

  // ---- travel reports ---------------------------------------------------------------

  @Get('travel-reports')
  @ApiOperation({ summary: 'Positive-travel report list with date/site/status filters' })
  listTravelReports(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('siteCode') siteCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listTravelReports({ search, status, from, to, siteCode, page, pageSize });
  }

  @Get('travel-reports/:id')
  @ApiOperation({ summary: 'Travel report detail (Contractor comment, travel record, cancellation notices)' })
  travelReportDetail(@Param('id') id: string) {
    return this.admin.travelReportDetail(id);
  }

  @Post('travel-reports/:id/review')
  @ApiOperation({ summary: 'Record review / follow-up status on a travel report' })
  reviewTravelReport(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: TravelReportReviewDto,
  ) {
    return this.admin.reviewTravelReport(user.userId, id, dto);
  }

  // ---- notifications -------------------------------------------------------------------

  @Get('notifications')
  @ApiOperation({ summary: 'Admin notification inbox (deduplicated event feed)' })
  listNotifications(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.admin.listNotifications({ unreadOnly: unreadOnly === 'true', page, pageSize });
  }

  @Post('notifications/:id/ack')
  @ApiOperation({ summary: 'Acknowledge a notification' })
  ack(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.admin.ackNotification(user.userId, id);
  }

  // ---- demonstration data controls (spec §8) -------------------------------------------

  @Get('demo-data')
  @ApiOperation({ summary: 'View demonstration dataset (contractor, site, 10 synthetic workers)' })
  getDemoData() {
    return this.admin.getDemoData();
  }

  @Post('demo-data/reset')
  @ApiOperation({ summary: 'Reset only the demonstration records within a safe transaction' })
  resetDemoData(@CurrentUser() user: RequestUser) {
    return this.admin.resetDemoData(user.userId);
  }

  // ---- demographic profile corrections (allowlist enforced) -----------------

  @Get('corrections')
  @ApiOperation({ summary: 'List worker demographic profile correction requests' })
  listCorrections(@Query('status') status?: string) {
    return this.admin.listCorrections({ status });
  }

  @Post('corrections/:id/review')
  @ApiOperation({ summary: 'Admin approves or rejects demographic correction with strict allowlist' })
  reviewCorrection(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReviewCorrectionDto,
  ) {
    return this.admin.reviewCorrection(user.userId, id, dto);
  }
}
