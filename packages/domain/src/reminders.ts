/**
 * Напоминания и жизненный цикл дедлайнов — чистые правила, без ИИ (принцип продукта).
 * Считаются одинаково на клиенте (в т.ч. офлайн) и на сервере.
 */

const MS_PER_DAY = 86_400_000;

/** Правило напоминания: сработать за `offsetDays` дней до дедлайна. */
export interface ReminderRule {
  offsetDays: number;
}

export interface ComputedReminder {
  offsetDays: number;
  fireAt: string;
}

/** Дата-время срабатывания для каждого правила, отсортированные по времени. */
export function computeReminders(deadlineISO: string, rules: ReminderRule[]): ComputedReminder[] {
  const deadline = new Date(deadlineISO);
  if (Number.isNaN(deadline.getTime())) {
    throw new Error(`Invalid deadline: ${deadlineISO}`);
  }
  return rules
    .map((rule) => {
      const fire = new Date(deadline.getTime() - rule.offsetDays * MS_PER_DAY);
      return { offsetDays: rule.offsetDays, fireAt: fire.toISOString() };
    })
    .sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/** Правила напоминаний по умолчанию: за 90 / 30 / 7 / 1 день до дедлайна. */
export const defaultReminderRules: ReminderRule[] = [
  { offsetDays: 90 },
  { offsetDays: 30 },
  { offsetDays: 7 },
  { offsetDays: 1 },
];

/**
 * Из чего пользователь выбирает свои пороги. Единая шкала важна: за 90 дней предупреждать о
 * подписке бессмысленно, а за 1 день о паспорте — поздно.
 */
export const reminderOffsetChoices = [365, 180, 90, 30, 14, 7, 3, 1] as const;

/** Пороги объекта: свои, если заданы, иначе — общие по умолчанию. */
export function reminderRulesFor(reminderDays: number[] | null | undefined): ReminderRule[] {
  if (!reminderDays || reminderDays.length === 0) return defaultReminderRules;
  return [...reminderDays].sort((a, b) => b - a).map((offsetDays) => ({ offsetDays }));
}

/** Ещё не наступившие напоминания для дедлайна (fireAt в будущем относительно now). */
export function upcomingReminders(
  deadlineISO: string,
  now: Date = new Date(),
  rules: ReminderRule[] = defaultReminderRules,
): ComputedReminder[] {
  return computeReminders(deadlineISO, rules).filter((r) => new Date(r.fireAt).getTime() >= now.getTime());
}

/** Целые дни до дедлайна (может быть отрицательным). null — если даты нет/она невалидна. */
export function daysUntil(validUntilISO: string | null | undefined, now: Date = new Date()): number | null {
  if (!validUntilISO) return null;
  const deadline = new Date(validUntilISO);
  if (Number.isNaN(deadline.getTime())) return null;
  return Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY);
}

export type Lifecycle = 'none' | 'ok' | 'due_soon' | 'overdue';

/**
 * Состояние объекта по дедлайну — управляет спокойной подачей в UI:
 * ok (шалфей) · due_soon (янтарь) · overdue (приглушённый brick).
 */
export function lifecycleFor(
  validUntilISO: string | null | undefined,
  now: Date = new Date(),
  dueSoonDays = 30,
): Lifecycle {
  const days = daysUntil(validUntilISO, now);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= dueSoonDays) return 'due_soon';
  return 'ok';
}
