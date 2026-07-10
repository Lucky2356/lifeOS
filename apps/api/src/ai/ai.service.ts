import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  isAiEnabled,
  mergeAiSettings,
  type AiModule,
  type AiSettings,
  type AiSuggestion,
  type UpdateAiSettings,
} from '@life-os/domain';
import { AI_SETTINGS_REPOSITORY, type AiSettingsRepository } from './ai-settings.repository';
import type { AiProvider } from './ai-provider';
import { NoopAiProvider } from './noop.provider';
import { ClaudeAiProvider } from './claude.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { GeminiProvider } from './gemini.provider';

const env = process.env;

@Injectable()
export class AiService {
  constructor(@Inject(AI_SETTINGS_REPOSITORY) private readonly settingsRepo: AiSettingsRepository) {}

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

  /**
   * Выбор провайдера по настройке пользователя. Каждый реальный провайдер включается только при
   * заданном ключе в окружении сервера; иначе — Noop (никаких внешних вызовов). Ключ не хранится
   * у пользователя и не передаётся клиенту.
   */
  private providerFor(settings: AiSettings): AiProvider {
    switch (settings.provider) {
      case 'claude':
        return env.ANTHROPIC_API_KEY ? new ClaudeAiProvider(env.ANTHROPIC_API_KEY) : new NoopAiProvider();
      case 'openai':
        return env.OPENAI_API_KEY
          ? new OpenAiCompatibleProvider(
              'openai',
              'https://api.openai.com/v1',
              env.OPENAI_API_KEY,
              env.OPENAI_MODEL ?? 'gpt-4o-mini',
            )
          : new NoopAiProvider();
      case 'deepseek':
        return env.DEEPSEEK_API_KEY
          ? new OpenAiCompatibleProvider(
              'deepseek',
              'https://api.deepseek.com/v1',
              env.DEEPSEEK_API_KEY,
              env.DEEPSEEK_MODEL ?? 'deepseek-chat',
            )
          : new NoopAiProvider();
      case 'gemini':
        return env.GEMINI_API_KEY
          ? new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.0-flash')
          : new NoopAiProvider();
      case 'custom':
        // Любой OpenAI-совместимый сервис (Groq, Mistral, OpenRouter, локальный Ollama и т.п.).
        return env.AI_CUSTOM_BASE_URL
          ? new OpenAiCompatibleProvider(
              'custom',
              env.AI_CUSTOM_BASE_URL,
              env.AI_CUSTOM_API_KEY ?? '',
              env.AI_CUSTOM_MODEL ?? 'gpt-3.5-turbo',
            )
          : new NoopAiProvider();
      default:
        return new NoopAiProvider();
    }
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
