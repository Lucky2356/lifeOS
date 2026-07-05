import { describe, it, expect } from 'vitest';
import { can, isMembershipActive, createMembership } from './household';

describe('can (RBAC матрица)', () => {
  it('владелец может всё', () => {
    expect(can('owner', 'manage_household')).toBe(true);
    expect(can('owner', 'manage_members')).toBe(true);
    expect(can('owner', 'view_audit')).toBe(true);
  });

  it('взрослый создаёт объекты/задачи и видит аудит, но не управляет участниками', () => {
    expect(can('adult', 'create_object')).toBe(true);
    expect(can('adult', 'create_task')).toBe(true);
    expect(can('adult', 'view_audit')).toBe(true);
    expect(can('adult', 'manage_members')).toBe(false);
    expect(can('adult', 'manage_household')).toBe(false);
  });

  it('ребёнок ограничен (только отметка задач), не видит аудит и не создаёт объекты', () => {
    expect(can('child', 'complete_task')).toBe(true);
    expect(can('child', 'create_object')).toBe(false);
    expect(can('child', 'view_audit')).toBe(false);
    expect(can('child', 'manage_members')).toBe(false);
  });

  it('гость по умолчанию не имеет прав уровня контура', () => {
    expect(can('guest', 'create_object')).toBe(false);
    expect(can('guest', 'view_audit')).toBe(false);
    expect(can('guest', 'complete_task')).toBe(false);
  });
});

describe('isMembershipActive', () => {
  const base = { householdId: '0'.repeat(8) };

  it('гость с истёкшим сроком неактивен', () => {
    const m = createMembership(
      {
        householdId: '00000000-0000-0000-0000-000000000001',
        userId: '00000000-0000-0000-0000-000000000002',
        displayName: 'Гость',
        role: 'guest',
        expiresAt: '2026-07-01T00:00:00.000Z',
      },
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(isMembershipActive(m, new Date('2026-07-05T00:00:00.000Z'))).toBe(false);
    expect(isMembershipActive(m, new Date('2026-06-15T00:00:00.000Z'))).toBe(true);
    void base;
  });

  it('участник без срока активен', () => {
    const m = createMembership({
      householdId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      displayName: 'Мария',
      role: 'adult',
    });
    expect(isMembershipActive(m)).toBe(true);
  });
});
