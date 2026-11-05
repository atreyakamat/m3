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
import { AdminModule } from './admin/admin.module';
import { RequestsModule } from './requests/requests.module';
import { TravelModule } from './travel/travel.module';
import { ContractorModule } from './contractor/contractor.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HealthWorkerModule } from './health-worker/health-worker.module';
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
    AdminModule,
    RequestsModule,
    TravelModule,
    ContractorModule,
    FacilitiesModule,
    HealthWorkerModule,
  ],
  controllers: [MetaController],
})
export class AppModule {}
