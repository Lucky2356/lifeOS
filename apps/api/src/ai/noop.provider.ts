import type { AiSuggestion } from '@life-os/domain';
import type { AiProvider } from './ai-provider';

/** Заглушка: ИИ не настроен/недоступен. Никаких внешних вызовов. */
export class NoopAiProvider implements AiProvider {
  readonly name = 'noop' as const;

  async suggest(): Promise<AiSuggestion> {
    return {
      source: 'ai',
      provider: 'noop',
      text: 'ИИ-провайдер не настроен. Это действие всегда можно выполнить вручную.',
    };
  }
}
