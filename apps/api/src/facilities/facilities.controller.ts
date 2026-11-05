import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { FacilitiesService } from './facilities.service';
import type {
  CreateFacilityInput,
  AssignStaffInput,
  CreateEscalationAlertInput,
  AcknowledgeEscalationInput,
  ActionEscalationInput,
} from '@m3/shared';

@ApiTags('facilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'facilities', version: '1' })
export class FacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  // ─── Facility CRUD ────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.HEALTH_WORKER, Role.CLINICIAN)
  @ApiOperation({ summary: 'List all PHCs and UHCs' })
  list(
    @Query('type') type?: string,
    @Query('taluka') taluka?: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
    return this.facilities.listFacilities({ type, taluka, isActive: activeBool });
  }

  @Get('escalations')
  @Roles(Role.ADMIN, Role.CLINICIAN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'List escalation alerts' })
  listEscalations(
    @CurrentUser() user: RequestUser,
    @Query('facilityId') facilityId?: string,
  ) {
    const clinicianUserId = user.role === Role.CLINICIAN ? user.userId : undefined;
    return this.facilities.listEscalationAlerts({ facilityId, clinicianUserId });
  }

  @Post('escalations')
  @Roles(Role.ADMIN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'Dispatch clinical escalation alert for a worker' })
  createEscalation(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateEscalationAlertInput,
  ) {
    return this.facilities.createEscalationAlert(user.userId, input);
  }

  @Post('escalations/:id/acknowledge')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Clinician acknowledges escalation alert' })
  acknowledgeEscalation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() input?: AcknowledgeEscalationInput,
  ) {
    return this.facilities.acknowledgeEscalation(id, user.userId, input?.notes || undefined);
  }

  @Post('escalations/:id/action')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Clinician records clinical action on escalation alert' })
  actionEscalation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() input: ActionEscalationInput,
  ) {
    return this.facilities.actionEscalation(id, user.userId, input.actionTaken);
  }

  @Post('staff')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign staff member to a facility' })
  assignStaff(
    @CurrentUser() user: RequestUser,
    @Body() input: AssignStaffInput,
  ) {
    return this.facilities.assignStaff(input, user.userId);
  }

  @Delete('staff/:assignmentId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'End staff assignment to a facility' })
  endStaffAssignment(
    @CurrentUser() user: RequestUser,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.facilities.endStaffAssignment(assignmentId, user.userId);
  }

  @Post('inbox/:notificationId/acknowledge')
  @Roles(Role.ADMIN, Role.CLINICIAN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'Acknowledge facility-level notification' })
  ackFacilityNotification(
    @CurrentUser() user: RequestUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.facilities.acknowledgeFacilityNotification(notificationId, user.userId);
  }

  @Post('inbox/:notificationId/action')
  @Roles(Role.ADMIN, Role.CLINICIAN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'Record action on facility-level notification' })
  actionFacilityNotification(
    @CurrentUser() user: RequestUser,
    @Param('notificationId') notificationId: string,
    @Body() body: { actionTaken: string },
  ) {
    return this.facilities.actionFacilityNotification(notificationId, user.userId, body.actionTaken);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HEALTH_WORKER, Role.CLINICIAN)
  @ApiOperation({ summary: 'Get facility details by ID' })
  getOne(@Param('id') id: string) {
    return this.facilities.getFacility(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create new PHC or UHC facility' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateFacilityInput,
  ) {
    return this.facilities.createFacility(input, user.userId);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update facility details' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() input: Partial<CreateFacilityInput>,
  ) {
    return this.facilities.updateFacility(id, input, user.userId);
  }

  @Get(':id/staff')
  @Roles(Role.ADMIN, Role.HEALTH_WORKER, Role.CLINICIAN)
  @ApiOperation({ summary: 'List staff assignments for a facility' })
  listStaff(@Param('id') id: string) {
    return this.facilities.listStaffAssignments(id);
  }

  @Get(':id/nearby-clinicians')
  @Roles(Role.ADMIN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get nearby clinicians calculated by distance/taluka' })
  nearbyClinicians(@Param('id') id: string) {
    return this.facilities.getNearbyClinicians(id);
  }

  @Get(':id/inbox')
  @Roles(Role.ADMIN, Role.CLINICIAN, Role.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get facility-level notification inbox' })
  facilityInbox(@Param('id') id: string) {
    return this.facilities.getFacilityInbox(id);
  }
}
