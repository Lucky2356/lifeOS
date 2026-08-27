import { z } from 'zod';
import { baseEntitySchema } from './sync';
import { newId } from './ids';

export const taskStatusSchema = z.enum(['open', 'done']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** Как часто задача возвращается. Бытовые дела повторяются, и заводить их руками каждый раз — работа. */
export const repeats = ['none', 'weekly', 'monthly', 'yearly'] as const;
export type Repeat = (typeof repeats)[number];
export const repeatSchema = z.enum(repeats);

export const repeatLabels: Record<Repeat, { ru: string; en: string }> = {
  none: { ru: 'Не повторять', en: 'No repeat' },
  weekly: { ru: 'Каждую неделю', en: 'Weekly' },
  monthly: { ru: 'Каждый месяц', en: 'Monthly' },
  yearly: { ru: 'Каждый год', en: 'Yearly' },
};

/** Общая бытовая задача дома (кто/что/когда). */
export const householdTaskSchema = baseEntitySchema.extend({
  householdId: z.string().uuid(),
  title: z.string().min(1).max(200),
  assigneeMembershipId: z.string().uuid().nullable(),
  dueAt: z.string().datetime().nullable(),
  status: taskStatusSchema,
  repeat: repeatSchema.default('none'),
});
export type HouseholdTask = z.infer<typeof householdTaskSchema>;

export const createHouseholdTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  assigneeMembershipId: z.string().uuid().nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  repeat: repeatSchema.default('none'),
});
export type CreateHouseholdTaskInput = z.input<typeof createHouseholdTaskInputSchema>;

export function createHouseholdTask(
  input: CreateHouseholdTaskInput,
  householdId: string,
  now: Date = new Date(),
): HouseholdTask {
  const parsed = createHouseholdTaskInputSchema.parse(input);
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    version: 0,
    deletedAt: null,
    householdId,
    title: parsed.title,
    assigneeMembershipId: parsed.assigneeMembershipId,
    dueAt: parsed.dueAt,
    status: 'open',
    repeat: parsed.repeat,
  };
}

/** Следующий срок повторяющейся задачи. null — задача не повторяется или у неё нет срока. */
export function nextDueDate(task: Pick<HouseholdTask, 'repeat' | 'dueAt'>): string | null {
  if (task.repeat === 'none' || !task.dueAt) return null;
  const next = new Date(task.dueAt);
  if (Number.isNaN(next.getTime())) return null;

  if (task.repeat === 'weekly') next.setDate(next.getDate() + 7);
  // Февраль и «31 число»: setMonth сам переносит на существующую дату следующего месяца.
  if (task.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
  if (task.repeat === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return next.toISOString();
}

/**
 * Отметить задачу. Повторяющаяся не «закрывается», а переезжает на следующий срок: смысл повтора
 * в том, чтобы дело возвращалось само, а не требовало заводить его заново.
 */
export function toggleTaskStatus(task: HouseholdTask, now: Date = new Date()): HouseholdTask {
  const base = { ...task, updatedAt: now.toISOString(), version: task.version + 1 };
  if (task.status === 'open') {
    const next = nextDueDate(task);
    if (next) return { ...base, dueAt: next };
  }
  return { ...base, status: task.status === 'open' ? 'done' : 'open' };
}
