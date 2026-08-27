import { describe, it, expect } from 'vitest';
import { createHouseholdTask, nextDueDate, toggleTaskStatus } from './household-task';

const HOUSE = '00000000-0000-0000-0000-000000000001';

describe('повторяющиеся задачи', () => {
  const make = (repeat: 'none' | 'weekly' | 'monthly' | 'yearly', dueAt: string | null) =>
    createHouseholdTask({ title: 'Показания счётчиков', dueAt, repeat }, HOUSE);

  it('считает следующий срок по периоду', () => {
    expect(nextDueDate(make('weekly', '2026-08-26T09:00:00.000Z'))).toBe('2026-09-02T09:00:00.000Z');
    expect(nextDueDate(make('monthly', '2026-08-26T09:00:00.000Z'))).toBe('2026-09-26T09:00:00.000Z');
    expect(nextDueDate(make('yearly', '2026-08-26T09:00:00.000Z'))).toBe('2027-08-26T09:00:00.000Z');
  });

  it('без повтора или без срока следующего срока нет', () => {
    expect(nextDueDate(make('none', '2026-08-26T09:00:00.000Z'))).toBeNull();
    expect(nextDueDate(make('monthly', null))).toBeNull();
  });

  it('31 января при месячном повторе не проваливается в несуществующее 31 февраля', () => {
    const next = nextDueDate(make('monthly', '2026-01-31T09:00:00.000Z'));
    // Ровно 31 февраля не существует — важно, что дата валидна и ушла вперёд.
    expect(next).not.toBeNull();
    expect(new Date(next!).getTime()).toBeGreaterThan(new Date('2026-01-31T09:00:00.000Z').getTime());
  });

  it('отметка повторяющейся задачи переносит срок, а не закрывает её', () => {
    const task = make('monthly', '2026-08-26T09:00:00.000Z');
    const toggled = toggleTaskStatus(task);

    expect(toggled.status).toBe('open');
    expect(toggled.dueAt).toBe('2026-09-26T09:00:00.000Z');
    expect(toggled.version).toBe(task.version + 1);
  });

  it('обычная задача закрывается и открывается как раньше', () => {
    const task = make('none', '2026-08-26T09:00:00.000Z');
    const done = toggleTaskStatus(task);
    expect(done.status).toBe('done');
    expect(done.dueAt).toBe(task.dueAt);
    expect(toggleTaskStatus(done).status).toBe('open');
  });

  it('повторяющаяся задача без срока ведёт себя как обычная', () => {
    expect(toggleTaskStatus(make('monthly', null)).status).toBe('done');
  });
});
