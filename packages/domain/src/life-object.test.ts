import { describe, it, expect } from 'vitest';
import {
  createLifeObject,
  applyLifeObjectUpdate,
  lifeObjectSchema,
  createLifeObjectInputSchema,
} from './life-object';

const owner = '00000000-0000-0000-0000-000000000001';

describe('createLifeObject', () => {
  it('создаёт валидный объект с sync-метаданными', () => {
    const now = new Date('2026-07-05T10:00:00.000Z');
    const obj = createLifeObject(
      { type: 'document', title: 'Загранпаспорт', validUntil: '2026-09-14T00:00:00.000Z' },
      owner,
      now,
    );

    expect(() => lifeObjectSchema.parse(obj)).not.toThrow();
    expect(obj.ownerUserId).toBe(owner);
    expect(obj.status).toBe('active');
    expect(obj.version).toBe(0);
    expect(obj.deletedAt).toBeNull();
    expect(obj.createdAt).toBe(now.toISOString());
  });

  it('подставляет дефолты (data, sensitivity, householdId)', () => {
    const obj = createLifeObject({ type: 'subscription', title: 'Облако' }, owner);
    expect(obj.data).toEqual({});
    expect(obj.sensitivity).toBe('normal');
    expect(obj.householdId).toBeNull();
  });

  it('отклоняет пустой заголовок', () => {
    expect(() => createLifeObjectInputSchema.parse({ type: 'document', title: '' })).toThrow();
  });
});

describe('applyLifeObjectUpdate', () => {
  it('бампит version, обновляет updatedAt и применяет патч', () => {
    const created = createLifeObject(
      { type: 'document', title: 'Паспорт' },
      owner,
      new Date('2026-07-05T10:00:00.000Z'),
    );
    const updated = applyLifeObjectUpdate(
      created,
      { title: 'Паспорт РФ', status: 'archived' },
      new Date('2026-07-06T10:00:00.000Z'),
    );

    expect(updated.version).toBe(1);
    expect(updated.title).toBe('Паспорт РФ');
    expect(updated.status).toBe('archived');
    expect(updated.updatedAt).toBe('2026-07-06T10:00:00.000Z');
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });
});
