import { Module } from '@nestjs/common';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_SETTINGS_REPOSITORY, InMemoryAiSettingsRepository } from './ai-settings.repository';
import { DrizzleAiSettingsRepository } from './drizzle-ai-settings.repository';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_SETTINGS_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleAiSettingsRepository(db) : new InMemoryAiSettingsRepository(),
    },
  ],
  exports: [AiService],
})
export class AiModule {}
