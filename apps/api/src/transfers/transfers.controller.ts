import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import {
  createContractorTransferSchema,
  createWorkerTransferSchema,
  transferDecisionSchema,
} from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { TransfersService } from './transfers.service';

class CreateWorkerTransferDto extends createZodDto(createWorkerTransferSchema) {}
class CreateContractorTransferDto extends createZodDto(createContractorTransferSchema) {}
class DecisionDto extends createZodDto(transferDecisionSchema) {}

@ApiTags('transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  private workerIdOf(u: RequestUser): string {
    if (!u.workerId) throw new ForbiddenException('Not a worker account');
    return u.workerId;
  }
  private contractorIdOf(u: RequestUser): string {
    if (!u.contractorId) throw new ForbiddenException('Not a contractor account');
    return u.contractorId;
  }

  // ---- worker ----
  @Post('worker')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker initiates a transfer to a destination site' })
  createWorker(@CurrentUser() u: RequestUser, @Body() dto: CreateWorkerTransferDto) {
    return this.transfers.createWorkerTransfer(this.workerIdOf(u), u.userId, dto);
  }

  @Get('me')
  @Roles('WORKER')
  @ApiOperation({ summary: 'List the worker own transfer requests and history' })
  mine(@CurrentUser() u: RequestUser) {
    return this.transfers.listForWorker(this.workerIdOf(u));
  }

  @Post(':id/worker/accept')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker accepts a contractor-initiated transfer' })
  workerAccept(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.transfers.workerDecision(this.workerIdOf(u), id, true, dto.reason);
  }

  @Post(':id/worker/reject')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker rejects a contractor-initiated transfer' })
  workerReject(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.transfers.workerDecision(this.workerIdOf(u), id, false, dto.reason);
  }

  // ---- contractor ----
  @Post('contractor')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Contractor initiates a transfer by Worker ID into a site they manage' })
  createContractor(@CurrentUser() u: RequestUser, @Body() dto: CreateContractorTransferDto) {
    return this.transfers.createContractorTransfer(this.contractorIdOf(u), dto);
  }

  @Get('approvals')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'List transfers currently awaiting this contractor approval' })
  approvals(@CurrentUser() u: RequestUser) {
    return this.transfers.listForContractorApproval(this.contractorIdOf(u));
  }

  @Post(':id/contractor/approve')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Contractor approves a transfer (backend resolves current vs destination slot)' })
  contractorApprove(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.transfers.contractorDecision(this.contractorIdOf(u), id, true, dto.reason);
  }

  @Post(':id/contractor/reject')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Contractor rejects a transfer' })
  contractorReject(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.transfers.contractorDecision(this.contractorIdOf(u), id, false, dto.reason);
  }

  // ---- shared ----
  @Post(':id/cancel')
  @Roles('WORKER', 'CONTRACTOR')
  @ApiOperation({ summary: 'Initiator cancels a pending transfer request' })
  cancel(@CurrentUser() u: RequestUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    const initiatorId = u.role === 'WORKER' ? u.userId : this.contractorIdOf(u);
    return this.transfers.cancel(initiatorId, id, dto.reason);
  }
}
