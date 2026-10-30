import { Body, Controller, ForbiddenException, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { completeScreeningSchema, saveScreeningDraftSchema } from '@m3/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';
import { ScreeningService } from './screening.service';

class SaveDraftDto extends createZodDto(saveScreeningDraftSchema) {}
class CompleteDto extends createZodDto(completeScreeningSchema) {}

@ApiTags('screening')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WORKER')
@Controller({ path: 'screening', version: '1' })
export class ScreeningController {
  constructor(private readonly screening: ScreeningService) {}

  private workerIdOf(user: RequestUser): string {
    if (!user.workerId) throw new ForbiddenException('Not a worker account');
    return user.workerId;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in worker initial screening (draft or complete)' })
  me(@CurrentUser() user: RequestUser) {
    return this.screening.getForWorker(this.workerIdOf(user));
  }

  @Put('me/draft')
  @ApiOperation({ summary: 'Save/resume an initial-screening draft' })
  saveDraft(@CurrentUser() user: RequestUser, @Body() dto: SaveDraftDto) {
    return this.screening.saveDraft(this.workerIdOf(user), dto);
  }

  @Post('me/complete')
  @ApiOperation({ summary: 'Complete the one-time initial screening (requires consent + required fields)' })
  complete(@CurrentUser() user: RequestUser, @Body() dto: CompleteDto) {
    return this.screening.complete(this.workerIdOf(user), dto);
  }
}
