import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HouseholdModule } from './household/household.module';
import { LedgerModule } from './ledger/ledger.module';

@Module({
  imports: [LedgerModule, HouseholdModule],
  controllers: [HealthController],
})
export class AppModule {}
