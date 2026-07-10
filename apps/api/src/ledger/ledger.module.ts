import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { DrizzleLifeObjectRepository } from './drizzle-life-object.repository';
import { InMemoryLifeObjectRepository } from './in-memory-life-object.repository';
import { LifeObjectController } from './life-object.controller';
import { LIFE_OBJECT_REPOSITORY } from './life-object.repository';
import { LifeObjectService } from './life-object.service';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentStorage } from './attachment-storage';
import { DrizzleAttachmentRepository } from './drizzle-attachment.repository';
import { ATTACHMENT_REPOSITORY, InMemoryAttachmentRepository } from './attachment.repository';

@Module({
  controllers: [LifeObjectController, AttachmentController],
  providers: [
    LifeObjectService,
    AttachmentService,
    AttachmentStorage,
    {
      provide: LIFE_OBJECT_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleLifeObjectRepository(db) : new InMemoryLifeObjectRepository(),
    },
    {
      provide: ATTACHMENT_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleAttachmentRepository(db) : new InMemoryAttachmentRepository(),
    },
  ],
  exports: [LifeObjectService],
})
export class LedgerModule {}
