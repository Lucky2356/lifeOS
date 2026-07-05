import { Body, Controller, Get, Put, Post } from '@nestjs/common';
import {
  aiSuggestRequestSchema,
  updateAiSettingsSchema,
  type AiModule,
  type UpdateAiSettings,
} from '@life-os/domain';
import { CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('settings')
  getSettings(@CurrentUserId() userId: string) {
    return this.service.getSettings(userId);
  }

  @Put('settings')
  updateSettings(
    @Body(new ZodValidationPipe(updateAiSettingsSchema)) patch: UpdateAiSettings,
    @CurrentUserId() userId: string,
  ) {
    return this.service.updateSettings(userId, patch);
  }

  @Post('suggest')
  suggest(
    @Body(new ZodValidationPipe(aiSuggestRequestSchema))
    body: { module: AiModule; action: string; context: string },
    @CurrentUserId() userId: string,
  ) {
    return this.service.suggest(userId, body);
  }
}
