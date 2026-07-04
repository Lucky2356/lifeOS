import { describe, it, expect } from 'vitest';
import { computeReminders, daysUntil, lifecycleFor } from './reminders';

describe('computeReminders', () => {
  it('вычисляет даты срабатывания за N дней до дедлайна и сортирует их', () => {
    const result = computeReminders('2026-09-14T00:00:00.000Z', [{ offsetDays: 30 }, { offsetDays: 90 }]);
    expect(result).toEqual([
      { offsetDays: 90, fireAt: '2026-06-16T00:00:00.000Z' },
      { offsetDays: 30, fireAt: '2026-08-15T00:00:00.000Z' },
    ]);
  });

  it('бросает ошибку на невалидном дедлайне', () => {
    expect(() => computeReminders('не-дата', [{ offsetDays: 7 }])).toThrow();
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-07-05T00:00:00.000Z');

  it('возвращает положительное число для будущей даты', () => {
    expect(daysUntil('2026-07-15T00:00:00.000Z', now)).toBe(10);
  });

  it('возвращает отрицательное число для прошедшей даты', () => {
    expect(daysUntil('2026-07-03T00:00:00.000Z', now)).toBe(-2);
  });

  it('возвращает null, если даты нет', () => {
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil(undefined, now)).toBeNull();
  });
});

describe('lifecycleFor', () => {
  const now = new Date('2026-07-05T00:00:00.000Z');

  it('none — когда дедлайна нет', () => {
    expect(lifecycleFor(null, now)).toBe('none');
  });

  it('overdue — когда дедлайн в прошлом', () => {
    expect(lifecycleFor('2026-07-03T00:00:00.000Z', now)).toBe('overdue');
  });

  it('due_soon — когда до дедлайна не больше порога', () => {
    expect(lifecycleFor('2026-07-20T00:00:00.000Z', now)).toBe('due_soon');
  });

  it('ok — когда до дедлайна далеко', () => {
    expect(lifecycleFor('2026-12-01T00:00:00.000Z', now)).toBe('ok');
  });
});
