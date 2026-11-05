import { createZodDto } from 'nestjs-zod';
import {
  changeCredentialSchema,
  loginSchema,
  staffLoginSchema,
  workerRegisterSchema,
} from '@m3/shared';

export class WorkerRegisterDto extends createZodDto(workerRegisterSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class StaffLoginDto extends createZodDto(staffLoginSchema) {}
export class ChangeCredentialDto extends createZodDto(changeCredentialSchema) {}
