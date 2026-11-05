import { Body, Controller, ForbiddenException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { createJoinRequestSchema } from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RequestsService } from './requests.service';

class CreateJoinRequestDto extends createZodDto(createJoinRequestSchema) {}

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'join-requests', version: '1' })
export class RequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker submits a join request for a construction site (pre-first-assignment)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateJoinRequestDto) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.requests.createJoinRequest(user.workerId, user.userId, dto.siteId);
  }

  @Post(':id/decide')
  @Roles('CONTRACTOR')
  @ApiOperation({ summary: 'Contractor accepts or declines a pending join request for their site' })
  decide(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { approve: boolean },
  ) {
    if (!user.contractorId) throw new ForbiddenException('Not a contractor account');
    return this.requests.contractorDecision(user.contractorId, id, Boolean(body?.approve), user.userId);
  }

  @Post(':id/cancel')
  @Roles('WORKER')
  @ApiOperation({ summary: 'Worker withdraws their own pending join request' })
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return this.requests.cancel(user.workerId, user.userId, id);
  }
}
