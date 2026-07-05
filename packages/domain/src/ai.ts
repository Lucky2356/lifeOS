import { z } from 'zod';

/**
 * ИИ — опциональный слой (ADR 0005). По умолчанию ВЫКЛЮЧЕН глобально: ни одна core-функция
 * от него не зависит. Провайдер вызывается только по явному действию и только при включённых тумблерах.
 */
export const aiModules = ['ledger', 'household', 'decision', 'navigator'] as const;
export type AiModule = (typeof aiModules)[number];

export const aiProviderNameSchema = z.enum(['noop', 'claude']);
export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

export const aiSettingsSchema = z.object({
  globalEnabled: z.boolean(),
  perModule: z.record(z.boolean()),
  provider: aiProviderNameSchema,
  /** Разрешить отправку чувствительных категорий (медицина/документы) провайдеру. По умолчанию — нет. */
  shareSensitive: z.boolean(),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const defaultAiSettings: AiSettings = {
  globalEnabled: false,
  perModule: { ledger: true, household: false, decision: true, navigator: true },
  provider: 'claude',
  shareSensitive: false,
};

export const updateAiSettingsSchema = aiSettingsSchema.partial();
export type UpdateAiSettings = z.infer<typeof updateAiSettingsSchema>;

/** Включён ли ИИ для модуля: глобальный тумблер И тумблер модуля. */
export function isAiEnabled(settings: AiSettings, module: AiModule): boolean {
  return settings.globalEnabled && (settings.perModule[module] ?? false);
}

export function mergeAiSettings(current: AiSettings, patch: UpdateAiSettings): AiSettings {
  return {
    ...current,
    ...patch,
    perModule: { ...current.perModule, ...(patch.perModule ?? {}) },
  };
}

/** Результат ИИ-подсказки — всегда помечен source:'ai' для UI-маркировки. */
export const aiSuggestionSchema = z.object({
  source: z.literal('ai'),
  provider: aiProviderNameSchema,
  text: z.string(),
});
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const aiSuggestRequestSchema = z.object({
  module: z.enum(aiModules),
  action: z.string().min(1).max(64),
  context: z.string().max(4000).default(''),
});
export type AiSuggestRequest = z.input<typeof aiSuggestRequestSchema>;
