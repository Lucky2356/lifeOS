import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { ContentService } from './content.service';
import { DrizzleProgressRepository } from './drizzle-progress.repository';
import { NavigatorController } from './navigator.controller';
import { InMemoryProgressRepository, PROGRESS_REPOSITORY } from './progress.repository';

@Module({
  controllers: [NavigatorController],
  providers: [
    ContentService,
    {
      provide: PROGRESS_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleProgressRepository(db) : new InMemoryProgressRepository(),
    },
  ],
})
export class NavigatorModule {}
