import { Module } from '@nestjs/common';
import { DecisionController } from './decision.controller';
import { DECISION_REPOSITORY } from './decision.repository';
import { DecisionService } from './decision.service';
import { InMemoryDecisionRepository } from './in-memory-decision.repository';

@Module({
  controllers: [DecisionController],
  providers: [DecisionService, { provide: DECISION_REPOSITORY, useClass: InMemoryDecisionRepository }],
})
export class DecisionModule {}
