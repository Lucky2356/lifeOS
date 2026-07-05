import { ConflictException, Injectable } from '@nestjs/common';
import {
  isAiEnabled,
  mergeAiSettings,
  type AiModule,
  type AiSettings,
  type AiSuggestion,
  type UpdateAiSettings,
} from '@life-os/domain';
import { AiSettingsRepository } from './ai-settings.repository';
import type { AiProvider } from './ai-provider';
import { NoopAiProvider } from './noop.provider';
import { ClaudeAiProvider } from './claude.provider';

@Injectable()
export class AiService {
  private readonly claudeKey = process.env.ANTHROPIC_API_KEY;

  constructor(private readonly settingsRepo: AiSettingsRepository) {}

  getSettings(userId: string): Promise<AiSettings> {
    return this.settingsRepo.get(userId);
  }

  async updateSettings(userId: string, patch: UpdateAiSettings): Promise<AiSettings> {
    const current = await this.settingsRepo.get(userId);
    return this.settingsRepo.save(userId, mergeAiSettings(current, patch));
  }

  resetSettings(userId: string): Promise<void> {
    return this.settingsRepo.delete(userId);
  }

  private providerFor(settings: AiSettings): AiProvider {
    if (settings.provider === 'claude' && this.claudeKey) {
      return new ClaudeAiProvider(this.claudeKey);
    }
    return new NoopAiProvider();
  }

  /** Предложение ИИ по явному действию. Бросает ai_disabled, если ИИ выключен для модуля. */
  async suggest(
    userId: string,
    req: { module: AiModule; action: string; context: string },
  ): Promise<AiSuggestion> {
    const settings = await this.settingsRepo.get(userId);
    if (!isAiEnabled(settings, req.module)) {
      throw new ConflictException({ code: 'ai_disabled', message: 'ИИ выключен для этого модуля' });
    }
    return this.providerFor(settings).suggest(req);
  }
}
