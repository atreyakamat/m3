import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangeCredentialDto, LoginDto, StaffLoginDto, WorkerRegisterDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { AllowPendingCredential } from '../common/allow-pending-credential.decorator';
import { CurrentUser, type RequestUser } from '../common/current-user.decorator';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('exists')
  @ApiOperation({ summary: 'Check whether a worker phone is already registered (returning-worker routing)' })
  async exists(@Query('phone') phone: string): Promise<{ exists: boolean }> {
    return { exists: await this.auth.phoneExists(phone ?? '') };
  }

  @Post('worker/register')
  @ApiOperation({ summary: 'Register a new worker (restricted distribution)' })
  async register(@Body() dto: WorkerRegisterDto) {
    return this.auth.registerWorker(dto);
  }

  @Post('worker/login')
  @ApiOperation({ summary: 'Sign in a returning worker with phone + PIN' })
  async login(@Body() dto: LoginDto) {
    return this.auth.loginWorker(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in returning worker or contractor by phone + PIN (identifies role)' })
  async loginAny(@Body() dto: LoginDto) {
    return this.auth.loginAny(dto);
  }

  @Post('staff/login')
  @ApiOperation({ summary: 'Sign in a non-worker stakeholder with username (or registered phone) + password/PIN' })
  async staffLogin(@Body() dto: StaffLoginDto) {
    return this.auth.staffLogin(dto);
  }

  @Post('change-credential')
  @UseGuards(JwtAuthGuard)
  @AllowPendingCredential()
  @ApiOperation({ summary: 'Mandatory first-login credential change (password for ADMIN, PIN for other stakeholders)' })
  async changeCredential(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangeCredentialDto,
  ) {
    return this.auth.changeCredential(user.userId, dto);
  }
}
