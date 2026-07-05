import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { DecisionController } from './decision.controller';
import { DECISION_REPOSITORY } from './decision.repository';
import { DecisionService } from './decision.service';
import { DrizzleDecisionRepository } from './drizzle-decision.repository';
import { InMemoryDecisionRepository } from './in-memory-decision.repository';

@Module({
  controllers: [DecisionController],
  providers: [
    DecisionService,
    {
      provide: DECISION_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleDecisionRepository(db) : new InMemoryDecisionRepository(),
    },
  ],
  exports: [DecisionService],
})
export class DecisionModule {}
