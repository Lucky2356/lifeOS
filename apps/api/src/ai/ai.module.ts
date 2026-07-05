import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSettingsRepository } from './ai-settings.repository';

@Module({
  controllers: [AiController],
  providers: [AiService, AiSettingsRepository],
  exports: [AiService],
})
export class AiModule {}
