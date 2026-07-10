import type { AiProviderName, AiSuggestion } from '@life-os/domain';
import type { AiProvider, SuggestInput } from './ai-provider';

/**
 * Адаптер под OpenAI-совместимый Chat Completions API (OpenAI, DeepSeek, Groq, Mistral, OpenRouter,
 * локальный Ollama и т.п.). Инстанцируется только при заданном ключе/адресе — иначе используется Noop.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    readonly name: AiProviderName,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async suggest(input: SuggestInput): Promise<AiSuggestion> {
    const prompt =
      `Ты — спокойный ассистент в приложении Life OS (модуль «${input.module}»). ` +
      `Пользователь просит: ${input.action}. Контекст: ${input.context || '—'}. ` +
      `Дай короткое, доброжелательное предложение следующего шага на русском. Без паники и давления.`;

    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`${this.name} API error ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    return { source: 'ai', provider: this.name, text };
  }
}
