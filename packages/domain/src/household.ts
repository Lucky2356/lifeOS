import { z } from 'zod';
import { baseEntitySchema } from './sync';
import { newId } from './ids';

/** Роль участника дома. Локально это просто пометка «кто он в доме», без прав доступа. */
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
});
export type Membership = z.infer<typeof membershipSchema>;

// --- Фабрики ---

export function createHousehold(name: string, createdBy: string, now: Date = new Date()): Household {
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
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
  },
  now: Date = new Date(),
): Membership {
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    version: 0,
    deletedAt: null,
    householdId: input.householdId,
    userId: input.userId,
    displayName: input.displayName,
    role: input.role,
    relationship: input.relationship ?? 'other',
  };
}
