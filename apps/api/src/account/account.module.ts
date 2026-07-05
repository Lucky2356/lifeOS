import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DecisionModule } from '../decision/decision.module';
import { HouseholdModule } from '../household/household.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [LedgerModule, DecisionModule, HouseholdModule, AiModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
