import { z } from 'zod';
import { objectTypeSchema } from './object-types';
import { newId } from './ids';

/** Локализованная строка контента (пак РФ, интерфейс RU + EN). */
export const localizedTextSchema = z.object({
  ru: z.string(),
  en: z.string(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const playbookStepSchema = z.object({
  key: z.string(),
  order: z.number().int(),
  title: localizedTextSchema,
  description: localizedTextSchema,
  /** Абстрактные типы документов — движок сопоставит с объектами Ledger (ADR 0004). */
  requiredDocumentTypes: z.array(objectTypeSchema).default([]),
  /** Ключ встроенного бюрократического гида (Bureaucracy внутри Crisis). */
  embedsGuideKey: z.string().nullable().default(null),
});
export type PlaybookStep = z.infer<typeof playbookStepSchema>;

export const playbookSchema = z.object({
  key: z.string(),
  kind: z.enum(['crisis', 'bureaucracy']),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  steps: z.array(playbookStepSchema),
});
export type Playbook = z.infer<typeof playbookSchema>;

export const contentPackSchema = z.object({
  packId: z.string(),
  version: z.string(),
  region: z.string(),
  locales: z.array(z.string()),
  playbooks: z.array(playbookSchema),
});
export type ContentPack = z.infer<typeof contentPackSchema>;

/** Валидирует контент-пак по схеме (используется при загрузке и в CI). */
export function validateContentPack(data: unknown): ContentPack {
  return contentPackSchema.parse(data);
}

export type Locale = 'ru' | 'en';

export function pickText(text: LocalizedText, locale: Locale): string {
  return text[locale] || text.ru;
}

// --- Прогресс пользователя по плейбуку/гиду ---

export const playbookProgressSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  packId: z.string(),
  packVersion: z.string(),
  playbookKey: z.string(),
  stepStates: z.record(z.boolean()),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type PlaybookProgress = z.infer<typeof playbookProgressSchema>;

export function startProgress(
  playbook: Playbook,
  pack: Pick<ContentPack, 'packId' | 'version'>,
  ownerUserId: string,
  now: Date = new Date(),
): PlaybookProgress {
  return {
    id: newId(),
    ownerUserId,
    packId: pack.packId,
    packVersion: pack.version,
    playbookKey: playbook.key,
    stepStates: Object.fromEntries(playbook.steps.map((s) => [s.key, false])),
    startedAt: now.toISOString(),
    completedAt: null,
  };
}

/**
 * Согласовать сохранённый прогресс с актуальным набором шагов плейбука.
 *
 * Контент-пак обновляется вместе с релизом приложения (ADR 0004), поэтому у уже начатого плейбука
 * шаги могут появиться или исчезнуть. Набор ключей задаёт плейбук, а не сохранённая запись: иначе
 * добавленный шаг виден на экране, но не участвует в подсчёте, а отметка по исчезнувшему шагу
 * навсегда искажает долю выполненного.
 */
export function reconcileProgress(
  progress: PlaybookProgress,
  playbook: Playbook,
  pack: Pick<ContentPack, 'packId' | 'version'>,
  now: Date = new Date(),
): PlaybookProgress {
  const stepStates = Object.fromEntries(
    playbook.steps.map((s) => [s.key, progress.stepStates[s.key] ?? false]),
  );
  // Плейбук, в который добавили шаг, перестаёт быть завершённым — иначе «выполнено» означало бы
  // выполнение прежней, более короткой версии.
  const allDone = playbook.steps.length > 0 && Object.values(stepStates).every(Boolean);
  return {
    ...progress,
    packId: pack.packId,
    packVersion: pack.version,
    stepStates,
    completedAt: allDone ? (progress.completedAt ?? now.toISOString()) : null,
  };
}

/** Доля выполненных шагов (0..1). */
export function progressPercent(progress: PlaybookProgress): number {
  const states = Object.values(progress.stepStates);
  if (states.length === 0) return 0;
  const done = states.filter(Boolean).length;
  return done / states.length;
}

export function toggleStep(
  progress: PlaybookProgress,
  stepKey: string,
  now: Date = new Date(),
): PlaybookProgress {
  const stepStates = { ...progress.stepStates, [stepKey]: !progress.stepStates[stepKey] };
  const allDone = Object.values(stepStates).every(Boolean);
  return {
    ...progress,
    stepStates,
    completedAt: allDone ? (progress.completedAt ?? now.toISOString()) : null,
  };
}
