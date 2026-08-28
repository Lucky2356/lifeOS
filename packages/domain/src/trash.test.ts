import { describe, expect, it } from 'vitest';
import {
  createLifeObject,
  daysLeftInTrash,
  restoreLifeObject,
  softDeleteLifeObject,
  trashExpired,
  trashRetentionDays,
} from './life-object';

const OWNER = '018f3a2e-0000-7000-8000-000000000001';

const object = (now = new Date('2026-08-01T10:00:00.000Z')) =>
  createLifeObject({ type: 'document', title: 'Паспорт' }, OWNER, now);

describe('корзина', () => {
  it('мягкое удаление помечает дату и бампит версию', () => {
    const deleted = softDeleteLifeObject(object(), new Date('2026-08-10T10:00:00.000Z'));
    expect(deleted.deletedAt).toBe('2026-08-10T10:00:00.000Z');
    expect(deleted.version).toBe(1);
    // Сам объект не меняется: восстановление обязано вернуть его в точности таким же.
    expect(deleted.title).toBe('Паспорт');
    expect(deleted.status).toBe('active');
  });

  it('восстановление снимает пометку', () => {
    const deleted = softDeleteLifeObject(object(), new Date('2026-08-10T10:00:00.000Z'));
    const restored = restoreLifeObject(deleted, new Date('2026-08-12T10:00:00.000Z'));
    expect(restored.deletedAt).toBeNull();
    expect(restored.version).toBe(2);
  });

  it('срок в корзине истекает ровно через отведённые дни', () => {
    const deleted = softDeleteLifeObject(object(), new Date('2026-08-01T10:00:00.000Z'));
    const dayBefore = new Date('2026-08-31T09:00:00.000Z');
    const dayAfter = new Date('2026-09-01T11:00:00.000Z');

    expect(trashExpired(deleted, dayBefore)).toBe(false);
    expect(trashExpired(deleted, dayAfter)).toBe(true);
  });

  it('живой объект никогда не считается протухшим', () => {
    expect(trashExpired(object(), new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
    expect(daysLeftInTrash(object())).toBeNull();
  });

  it('считает оставшиеся дни и не уходит в минус', () => {
    const deleted = softDeleteLifeObject(object(), new Date('2026-08-01T10:00:00.000Z'));
    expect(daysLeftInTrash(deleted, new Date('2026-08-01T10:00:00.000Z'))).toBe(trashRetentionDays);
    expect(daysLeftInTrash(deleted, new Date('2026-08-21T10:00:00.000Z'))).toBe(10);
    expect(daysLeftInTrash(deleted, new Date('2027-01-01T10:00:00.000Z'))).toBe(0);
  });

  it('битая дата удаления не роняет расчёт', () => {
    const broken = { deletedAt: 'не дата' };
    expect(trashExpired(broken)).toBe(false);
    expect(daysLeftInTrash(broken)).toBeNull();
  });
});
