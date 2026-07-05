import type { AiProviderName, AiSuggestion } from '@life-os/domain';

export interface SuggestInput {
  module: string;
  action: string;
  context: string;
}

/** Провайдер ИИ (ADR 0005). Реализации: Noop (по умолчанию) и Claude (по ключу). */
export interface AiProvider {
  readonly name: AiProviderName;
  suggest(input: SuggestInput): Promise<AiSuggestion>;
}
