import { Module } from '@nestjs/common';
import { HealthWorkerController } from './health-worker.controller';
import { HealthWorkerService } from './health-worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [HealthWorkerController],
  providers: [HealthWorkerService],
  exports: [HealthWorkerService],
})
export class HealthWorkerModule {}
