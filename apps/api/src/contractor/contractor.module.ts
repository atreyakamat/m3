import { Module } from '@nestjs/common';
import { ContractorController } from './contractor.controller';
import { ContractorService } from './contractor.service';
import { AdminModule } from '../admin/admin.module';
import { TransfersModule } from '../transfers/transfers.module';

@Module({
  imports: [AdminModule, TransfersModule],
  controllers: [ContractorController],
  providers: [ContractorService],
  exports: [ContractorService],
})
export class ContractorModule {}
