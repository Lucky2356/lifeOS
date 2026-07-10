import type { AiSuggestion } from '@life-os/domain';
import type { AiProvider, SuggestInput } from './ai-provider';

/**
 * Адаптер Google Gemini (generateContent). Инстанцируется только при заданном GEMINI_API_KEY —
 * иначе используется Noop, внешних вызовов не происходит.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async suggest(input: SuggestInput): Promise<AiSuggestion> {
    const prompt =
      `Ты — спокойный ассистент в приложении Life OS (модуль «${input.module}»). ` +
      `Пользователь просит: ${input.action}. Контекст: ${input.context || '—'}. ` +
      `Дай короткое, доброжелательное предложение следующего шага на русском. Без паники и давления.`;

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { source: 'ai', provider: 'gemini', text };
  }
}
