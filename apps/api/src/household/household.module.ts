import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { DrizzleHouseholdRepository } from './drizzle-household.repository';
import { HouseholdController } from './household.controller';
import { HOUSEHOLD_REPOSITORY } from './household.repository';
import { HouseholdService } from './household.service';
import { InMemoryHouseholdRepository } from './in-memory-household.repository';

@Module({
  controllers: [HouseholdController],
  providers: [
    HouseholdService,
    {
      provide: HOUSEHOLD_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleHouseholdRepository(db) : new InMemoryHouseholdRepository(),
    },
  ],
  exports: [HouseholdService],
})
export class HouseholdModule {}
