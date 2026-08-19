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

/** Свежий id для критерия/варианта на клиенте. */
export function newDecisionChildId(): string {
  return newId();
}
