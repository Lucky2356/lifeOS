import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { DrizzleLifeObjectRepository } from './drizzle-life-object.repository';
import { InMemoryLifeObjectRepository } from './in-memory-life-object.repository';
import { LifeObjectController } from './life-object.controller';
import { LIFE_OBJECT_REPOSITORY } from './life-object.repository';
import { LifeObjectService } from './life-object.service';

@Module({
  controllers: [LifeObjectController],
  providers: [
    LifeObjectService,
    {
      provide: LIFE_OBJECT_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleLifeObjectRepository(db) : new InMemoryLifeObjectRepository(),
    },
  ],
  exports: [LifeObjectService],
})
export class LedgerModule {}
