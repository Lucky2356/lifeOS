import { Module } from '@nestjs/common';
import { HouseholdController } from './household.controller';
import { HOUSEHOLD_REPOSITORY } from './household.repository';
import { HouseholdService } from './household.service';
import { InMemoryHouseholdRepository } from './in-memory-household.repository';

@Module({
  controllers: [HouseholdController],
  providers: [HouseholdService, { provide: HOUSEHOLD_REPOSITORY, useClass: InMemoryHouseholdRepository }],
})
export class HouseholdModule {}
