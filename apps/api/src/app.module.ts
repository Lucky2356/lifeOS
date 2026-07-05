import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HouseholdModule } from './household/household.module';
import { LedgerModule } from './ledger/ledger.module';
import { DecisionModule } from './decision/decision.module';
import { NavigatorModule } from './navigator/navigator.module';
import { AiModule } from './ai/ai.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [LedgerModule, HouseholdModule, DecisionModule, NavigatorModule, AiModule, AccountModule],
  controllers: [HealthController],
})
export class AppModule {}
