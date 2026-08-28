import { z } from 'zod';
import { baseEntitySchema } from './sync';
import { newId } from './ids';

export const decisionCriterionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(120),
  weight: z.number().int().min(1).max(5),
});
export type DecisionCriterion = z.infer<typeof decisionCriterionSchema>;

export const decisionOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(120),
  /** Оценка варианта по каждому критерию: criterionId → 0..5. */
  scores: z.record(z.number().min(0).max(5)),
});
export type DecisionOption = z.infer<typeof decisionOptionSchema>;

export const decisionStatusSchema = z.enum(['draft', 'decided']);
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;

export const decisionSchema = baseEntitySchema.extend({
  ownerUserId: z.string().uuid(),
  title: z.string().min(1).max(200),
  context: z.string().max(2000),
  status: decisionStatusSchema,
  criteria: z.array(decisionCriterionSchema),
  options: z.array(decisionOptionSchema),
  chosenOptionId: z.string().nullable(),
  /** Итог: чего ждали и что вышло — для анализа паттернов со временем. */
  expectedOutcome: z.string().max(2000),
  actualOutcome: z.string().max(2000).nullable(),
  decidedAt: z.string().datetime().nullable(),
  /**
   * Когда вернуться и посмотреть, что вышло. Без этой даты журнал исхода видит только тот, кто
   * случайно откроет экран: «через полгода я рассчитываю…» некому напомнить о себе.
   */
  reviewAt: z.string().datetime().nullable().default(null),
});
export type Decision = z.infer<typeof decisionSchema>;

export interface ScoredOption {
  optionId: string;
  label: string;
  total: number;
}

/** Взвешенный балл каждого варианта: Σ(weight × score). Отсортировано по убыванию. */
export function scoreOptions(decision: Pick<Decision, 'criteria' | 'options'>): ScoredOption[] {
  return decision.options
    .map((opt) => {
      const total = decision.criteria.reduce((sum, c) => sum + c.weight * (opt.scores[c.id] ?? 0), 0);
      return { optionId: opt.id, label: opt.label, total };
    })
    .sort((a, b) => b.total - a.total);
}

export const createDecisionInputSchema = z.object({
  title: z.string().min(1).max(200),
  context: z.string().max(2000).default(''),
});
export type CreateDecisionInput = z.input<typeof createDecisionInputSchema>;

export const updateDecisionInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    context: z.string().max(2000),
    status: decisionStatusSchema,
    criteria: z.array(decisionCriterionSchema),
    options: z.array(decisionOptionSchema),
    chosenOptionId: z.string().nullable(),
    expectedOutcome: z.string().max(2000),
    actualOutcome: z.string().max(2000).nullable(),
    decidedAt: z.string().datetime().nullable(),
    reviewAt: z.string().datetime().nullable(),
  })
  .partial();
export type UpdateDecisionInput = z.infer<typeof updateDecisionInputSchema>;

export function createDecision(
  input: CreateDecisionInput,
  ownerUserId: string,
  now: Date = new Date(),
): Decision {
  const parsed = createDecisionInputSchema.parse(input);
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    version: 0,
    deletedAt: null,
    ownerUserId,
    title: parsed.title,
    context: parsed.context,
    status: 'draft',
    criteria: [],
    options: [],
    chosenOptionId: null,
    expectedOutcome: '',
    actualOutcome: null,
    decidedAt: null,
    reviewAt: null,
  };
}

export function applyDecisionUpdate(
  current: Decision,
  patch: UpdateDecisionInput,
  now: Date = new Date(),
): Decision {
  const parsed = updateDecisionInputSchema.parse(patch);
  return {
    ...current,
    ...parsed,
    updatedAt: now.toISOString(),
    version: current.version + 1,
  };
}

/** Через сколько месяцев предложено вернуться к решению. 0 — не напоминать. */
export const reviewMonthChoices = [0, 3, 6, 12] as const;
export type ReviewMonths = (typeof reviewMonthChoices)[number];

/** Дата возврата к решению через N месяцев. 0 месяцев — возврата нет. */
export function reviewDateAfter(months: number, now: Date = new Date()): string | null {
  if (months <= 0) return null;
  const at = new Date(now);
  // Полдень, а не полночь: напоминание должно приходить днём, а не в момент смены суток.
  at.setHours(12, 0, 0, 0);
  at.setMonth(at.getMonth() + months);
  return at.toISOString();
}

/**
 * Зафиксировать решение: выбранный вариант, статус и дату. Ради этого модуль и существует —
 * без фиксации выбора матрица остаётся упражнением, а журнала исходов не возникает.
 *
 * `reviewMonths` назначает дату, когда стоит оглянуться: без неё запись «чего я жду» так и
 * останется непрочитанной.
 */
export function decideDecision(
  current: Decision,
  chosenOptionId: string,
  reviewMonths = 0,
  now: Date = new Date(),
): Decision {
  if (!current.options.some((o) => o.id === chosenOptionId)) {
    throw new Error('Выбранного варианта нет в решении');
  }
  return applyDecisionUpdate(
    current,
    {
      status: 'decided',
      chosenOptionId,
      decidedAt: now.toISOString(),
      reviewAt: reviewDateAfter(reviewMonths, now),
    },
    now,
  );
}

/** Вернуть решение в черновик: выбор снимается, записанный исход стирается. */
export function reopenDecision(current: Decision, now: Date = new Date()): Decision {
  return applyDecisionUpdate(
    current,
    { status: 'draft', chosenOptionId: null, decidedAt: null, actualOutcome: null, reviewAt: null },
    now,
  );
}

/** Записать, что вышло на самом деле. Имеет смысл только для принятого решения. */
export function recordOutcome(current: Decision, outcome: string, now: Date = new Date()): Decision {
  if (current.status !== 'decided') {
    throw new Error('Исход записывается только для принятого решения');
  }
  // Исход записан — возвращаться больше незачем, напоминание снимается.
  return applyDecisionUpdate(current, { actualOutcome: outcome, reviewAt: null }, now);
}

/** Свежий id для критерия/варианта на клиенте. */
export function newDecisionChildId(): string {
  return newId();
}
