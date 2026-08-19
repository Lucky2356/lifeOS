import { describe, it, expect } from 'vitest';
import { createHousehold, createMembership, defaultRoleForRelationship } from './household';

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001';
const USER = '00000000-0000-0000-0000-000000000002';

describe('defaultRoleForRelationship', () => {
  it('дети и внуки получают роль ребёнка', () => {
    expect(defaultRoleForRelationship('child')).toBe('child');
    expect(defaultRoleForRelationship('grandchild')).toBe('child');
  });

  it('остальные — взрослого', () => {
    expect(defaultRoleForRelationship('partner')).toBe('adult');
    expect(defaultRoleForRelationship('parent')).toBe('adult');
    expect(defaultRoleForRelationship('other')).toBe('adult');
  });
});

describe('createHousehold', () => {
  it('проставляет метаданные и автора', () => {
    const h = createHousehold('Наш дом', USER, new Date('2026-08-19T10:00:00.000Z'));
    expect(h.name).toBe('Наш дом');
    expect(h.createdBy).toBe(USER);
    expect(h.version).toBe(0);
    expect(h.deletedAt).toBeNull();
    expect(h.createdAt).toBe('2026-08-19T10:00:00.000Z');
  });
});

describe('createMembership', () => {
  it('по умолчанию родственный статус — «другое»', () => {
    const m = createMembership({ householdId: HOUSEHOLD, userId: USER, displayName: 'Мария', role: 'adult' });
    expect(m.relationship).toBe('other');
    expect(m.householdId).toBe(HOUSEHOLD);
    expect(m.displayName).toBe('Мария');
  });

  it('сохраняет переданный статус', () => {
    const m = createMembership({
      householdId: HOUSEHOLD,
      userId: USER,
      displayName: 'Дима',
      role: 'child',
      relationship: 'child',
    });
    expect(m.relationship).toBe('child');
    expect(m.role).toBe('child');
  });
});
