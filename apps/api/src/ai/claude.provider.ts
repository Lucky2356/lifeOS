import type { AiSuggestion } from '@life-os/domain';
import type { AiProvider, SuggestInput } from './ai-provider';

/**
 * Адаптер Claude API. Инстанцируется только при заданном ANTHROPIC_API_KEY —
 * без ключа система использует NoopAiProvider, внешних вызовов не происходит.
 */
export class ClaudeAiProvider implements AiProvider {
  readonly name = 'claude' as const;

  constructor(private readonly apiKey: string) {}

  async suggest(input: SuggestInput): Promise<AiSuggestion> {
    const prompt =
      `Ты — спокойный ассистент в приложении Life OS (модуль «${input.module}»). ` +
      `Пользователь просит: ${input.action}. Контекст: ${input.context || '—'}. ` +
      `Дай короткое, доброжелательное предложение следующего шага на русском. Без паники и давления.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude API error ${res.status}`);
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? '';
    return { source: 'ai', provider: 'claude', text };
  }
}
