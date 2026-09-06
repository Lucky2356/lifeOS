import { z } from 'zod';
import { objectTypeSchema } from './object-types';
import { newId } from './ids';

/**
 * Локализованная строка контента (пак РФ, интерфейс RU + EN).
 *
 * Оба языка обязательны и непусты: pickText при пустом переводе молча подставляет русский, и
 * недоперевод обнаружился бы только глазами читателя, а не гейтом.
 */
export const localizedTextSchema = z.object({
  ru: z.string().min(1),
  en: z.string().min(1),
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
  steps: z.array(playbookStepSchema).min(1),
});
export type Playbook = z.infer<typeof playbookSchema>;

/** Проверки одного плейбука — вынесены из superRefine, чтобы вложенность оставалась читаемой. */
function checkPlaybook(
  playbook: Playbook,
  index: number,
  kinds: Map<string, Playbook['kind']>,
  ctx: z.RefinementCtx,
): void {
  const at = (...tail: (string | number)[]) => ['playbooks', index, ...tail];
  const complain = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

  const orders = playbook.steps.map((s) => s.order).sort((a, b) => a - b);
  // Шаги нумеруются подряд с единицы: дыра или дубль означают потерянный или задвоенный шаг.
  if (orders.some((order, k) => order !== k + 1)) {
    complain(
      at('steps'),
      `Шаги «${playbook.key}» должны быть пронумерованы подряд от 1 до ${playbook.steps.length}`,
    );
  }

  playbook.steps.forEach((step, k) => {
    if (playbook.steps.findIndex((s) => s.key === step.key) !== k) {
      complain(at('steps', k, 'key'), `Ключ шага «${step.key}» повторяется внутри «${playbook.key}»`);
    }

    // Пилюля «Открыть гид» рисуется только для существующего гида, поэтому ссылка в никуда не
    // ломает экран — она молча лишает шаг обещанной подсказки. Ловим здесь.
    const guide = step.embedsGuideKey;
    if (guide === null) return;
    const kind = kinds.get(guide);
    if (kind === undefined) {
      complain(
        at('steps', k, 'embedsGuideKey'),
        `Шаг «${step.key}» ссылается на гид «${guide}», которого нет в паке`,
      );
    } else if (kind !== 'bureaucracy') {
      complain(
        at('steps', k, 'embedsGuideKey'),
        `Гид «${guide}» должен быть kind: bureaucracy, а не ${kind}`,
      );
    }
  });
}

/**
 * Правила целостности пака живут в схеме, а не в скрипте валидации: схема — единственный источник
 * правды о паке, и её же зовёт любая проверка, включая будущую проверку в рантайме. Правило,
 * лежащее в скрипте, во втором случае просто не сработает.
 */
export const contentPackSchema = z
  .object({
    packId: z.string(),
    version: z.string(),
    region: z.string(),
    locales: z.array(z.string()),
    playbooks: z.array(playbookSchema),
  })
  .superRefine((pack, ctx) => {
    const kinds = new Map(pack.playbooks.map((p) => [p.key, p.kind]));
    pack.playbooks.forEach((playbook, i) => {
      if (pack.playbooks.findIndex((p) => p.key === playbook.key) !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['playbooks', i, 'key'],
          message: `Ключ плейбука «${playbook.key}» повторяется`,
        });
      }
      checkPlaybook(playbook, i, kinds, ctx);
    });
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
