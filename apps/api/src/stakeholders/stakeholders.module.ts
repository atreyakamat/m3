import { Module } from '@nestjs/common';
import { StakeholdersController } from './stakeholders.controller';

@Module({
  controllers: [StakeholdersController],
})
export class StakeholdersModule {}
