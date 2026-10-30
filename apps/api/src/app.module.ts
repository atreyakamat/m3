import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { WorkersModule } from './workers/workers.module';
import { SitesModule } from './sites/sites.module';
import { ScreeningModule } from './screening/screening.module';
import { RecordsModule } from './records/records.module';
import { TransfersModule } from './transfers/transfers.module';
import { StakeholdersModule } from './stakeholders/stakeholders.module';
import { MetaController } from './meta/meta.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    CommonModule,
    AuthModule,
    WorkersModule,
    SitesModule,
    ScreeningModule,
    RecordsModule,
    TransfersModule,
    StakeholdersModule,
  ],
  controllers: [MetaController],
})
export class AppModule {}
