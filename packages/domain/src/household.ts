import { z } from 'zod';
import { baseEntitySchema, initialHlc } from './sync';
import { newId } from './ids';

/** Роли участника контура (дома). См. docs/RBAC.md. */
export const roles = ['owner', 'adult', 'child', 'guest'] as const;
export type Role = (typeof roles)[number];
export const roleSchema = z.enum(roles);

export const roleLabels: Record<Role, { ru: string; en: string }> = {
  owner: { ru: 'Владелец', en: 'Owner' },
  adult: { ru: 'Взрослый', en: 'Adult' },
  child: { ru: 'Ребёнок', en: 'Child' },
  guest: { ru: 'Гость', en: 'Guest' },
};

/** Родственный/семейный статус участника — отдельно от роли (роль = права, статус = кто это). */
export const relationships = [
  'self',
  'husband',
  'wife',
  'partner',
  'child',
  'parent',
  'sibling',
  'mother_in_law',
  'father_in_law',
  'son_in_law',
  'daughter_in_law',
  'grandparent',
  'grandchild',
  'roommate',
  'friend',
  'other',
] as const;
export type Relationship = (typeof relationships)[number];
export const relationshipSchema = z.enum(relationships);

export const relationshipLabels: Record<Relationship, { ru: string; en: string }> = {
  self: { ru: 'Я', en: 'Me' },
  husband: { ru: 'Муж', en: 'Husband' },
  wife: { ru: 'Жена', en: 'Wife' },
  partner: { ru: 'Партнёр (девушка/парень)', en: 'Partner' },
  child: { ru: 'Ребёнок', en: 'Child' },
  parent: { ru: 'Родитель', en: 'Parent' },
  sibling: { ru: 'Брат / сестра', en: 'Sibling' },
  mother_in_law: { ru: 'Тёща / свекровь', en: 'Mother-in-law' },
  father_in_law: { ru: 'Тесть / свёкор', en: 'Father-in-law' },
  son_in_law: { ru: 'Зять', en: 'Son-in-law' },
  daughter_in_law: { ru: 'Сноха / невестка', en: 'Daughter-in-law' },
  grandparent: { ru: 'Бабушка / дедушка', en: 'Grandparent' },
  grandchild: { ru: 'Внук / внучка', en: 'Grandchild' },
  roommate: { ru: 'Сосед по дому', en: 'Roommate' },
  friend: { ru: 'Друг', en: 'Friend' },
  other: { ru: 'Другое', en: 'Other' },
};

/** Разумная роль по умолчанию для родственного статуса (можно переопределить вручную). */
export function defaultRoleForRelationship(rel: Relationship): Role {
  if (rel === 'child' || rel === 'grandchild') return 'child';
  return 'adult';
}

/** Действия уровня контура для проверки прав (role-level capabilities). */
export const householdActions = [
  'manage_household',
  'manage_members',
  'invite_member',
  'view_audit',
  'create_object',
  'create_task',
  'complete_task',
] as const;
export type HouseholdAction = (typeof householdActions)[number];

/**
 * Матрица прав по ролям. Принцип наименьших привилегий: child/guest по умолчанию
 * почти ничего не могут на уровне контура; доступ к конкретным ресурсам выдаётся
 * отдельными share-грантами (row-level), а не ролью.
 */
const matrix: Record<Role, ReadonlySet<HouseholdAction>> = {
  owner: new Set(householdActions),
  adult: new Set<HouseholdAction>(['view_audit', 'create_object', 'create_task', 'complete_task']),
  child: new Set<HouseholdAction>(['complete_task']),
  guest: new Set<HouseholdAction>([]),
};

/** Может ли роль выполнить действие уровня контура. */
export function can(role: Role, action: HouseholdAction): boolean {
  return matrix[role].has(action);
}

// --- Сущности ---

export const householdSchema = baseEntitySchema.extend({
  name: z.string().min(1).max(120),
  createdBy: z.string().uuid(),
});
export type Household = z.infer<typeof householdSchema>;

export const membershipSchema = baseEntitySchema.extend({
  householdId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(120),
  role: roleSchema,
  relationship: relationshipSchema.default('other'),
  expiresAt: z.string().datetime().nullable(),
});
export type Membership = z.infer<typeof membershipSchema>;

export const accessLevels = ['view', 'edit', 'manage'] as const;
export type AccessLevel = (typeof accessLevels)[number];

export const shareGrantSchema = baseEntitySchema.extend({
  householdId: z.string().uuid(),
  resourceType: z.string(),
  resourceId: z.string().uuid(),
  granteeMembershipId: z.string().uuid().nullable(),
  accessLevel: z.enum(accessLevels),
  expiresAt: z.string().datetime().nullable(),
});
export type ShareGrant = z.infer<typeof shareGrantSchema>;

// --- Фабрики ---

export function createHousehold(name: string, createdBy: string, now: Date = new Date()): Household {
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    hlc: initialHlc(now),
    version: 0,
    deletedAt: null,
    name,
    createdBy,
  };
}

export function createMembership(
  input: {
    householdId: string;
    userId: string;
    displayName: string;
    role: Role;
    relationship?: Relationship;
    expiresAt?: string | null;
  },
  now: Date = new Date(),
): Membership {
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    hlc: initialHlc(now),
    version: 0,
    deletedAt: null,
    householdId: input.householdId,
    userId: input.userId,
    displayName: input.displayName,
    role: input.role,
    relationship: input.relationship ?? 'other',
    expiresAt: input.expiresAt ?? null,
  };
}

/** Активно ли членство сейчас (не истёк гостевой доступ). */
export function isMembershipActive(m: Membership, now: Date = new Date()): boolean {
  if (m.deletedAt !== null) return false;
  if (m.expiresAt && new Date(m.expiresAt).getTime() < now.getTime()) return false;
  return true;
}
