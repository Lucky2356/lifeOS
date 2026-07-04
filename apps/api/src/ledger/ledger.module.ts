import { Module } from '@nestjs/common';
import { InMemoryLifeObjectRepository } from './in-memory-life-object.repository';
import { LifeObjectController } from './life-object.controller';
import { LIFE_OBJECT_REPOSITORY } from './life-object.repository';
import { LifeObjectService } from './life-object.service';

@Module({
  controllers: [LifeObjectController],
  providers: [
    LifeObjectService,
    { provide: LIFE_OBJECT_REPOSITORY, useClass: InMemoryLifeObjectRepository },
  ],
})
export class LedgerModule {}
