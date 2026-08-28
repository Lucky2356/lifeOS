import { z } from 'zod';
import { baseEntitySchema } from './sync';
import { newId } from './ids';
import { objectTypeSchema } from './object-types';

export const sensitivitySchema = z.enum(['normal', 'sensitive', 'high']);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

export const lifeObjectStatusSchema = z.enum(['active', 'archived']);
export type LifeObjectStatus = z.infer<typeof lifeObjectStatusSchema>;

/** Полная сущность «объект жизни» — ядро Life Ledger (см. docs/DATA_MODEL.md). */
export const lifeObjectSchema = baseEntitySchema.extend({
  householdId: z.string().uuid().nullable(),
  ownerUserId: z.string().uuid(),
  type: objectTypeSchema,
  title: z.string().min(1).max(200),
  data: z.record(z.unknown()),
  status: lifeObjectStatusSchema,
  sensitivity: sensitivitySchema,
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  /** Свои пороги напоминаний в днях до срока. null — общие по умолчанию (90/30/7/1). */
  reminderDays: z.array(z.number().int().positive()).nullable().default(null),
});

export type LifeObject = z.infer<typeof lifeObjectSchema>;

/** Вход на создание — то, что присылает клиент; sync-метаданные проставляет домен. */
export const createLifeObjectInputSchema = z.object({
  type: objectTypeSchema,
  title: z.string().min(1).max(200),
  data: z.record(z.unknown()).default({}),
  sensitivity: sensitivitySchema.default('normal'),
  householdId: z.string().uuid().nullable().default(null),
  validFrom: z.string().datetime().nullable().default(null),
  validUntil: z.string().datetime().nullable().default(null),
  reminderDays: z.array(z.number().int().positive()).nullable().default(null),
});

export type CreateLifeObjectInput = z.input<typeof createLifeObjectInputSchema>;

export const updateLifeObjectInputSchema = z
  .object({
    title: z.string().min(1).max(200),
    data: z.record(z.unknown()),
    sensitivity: sensitivitySchema,
    validFrom: z.string().datetime().nullable(),
    validUntil: z.string().datetime().nullable(),
    status: lifeObjectStatusSchema,
    reminderDays: z.array(z.number().int().positive()).nullable(),
  })
  .partial();

export type UpdateLifeObjectInput = z.infer<typeof updateLifeObjectInputSchema>;

/** Создать новый объект жизни: валидирует вход и проставляет sync-метаданные. */
export function createLifeObject(
  input: CreateLifeObjectInput,
  ownerUserId: string,
  now: Date = new Date(),
): LifeObject {
  const parsed = createLifeObjectInputSchema.parse(input);
  const ts = now.toISOString();
  return {
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
    version: 0,
    deletedAt: null,
    ownerUserId,
    householdId: parsed.householdId,
    type: parsed.type,
    title: parsed.title,
    data: parsed.data,
    status: 'active',
    sensitivity: parsed.sensitivity,
    validFrom: parsed.validFrom,
    validUntil: parsed.validUntil,
    reminderDays: parsed.reminderDays,
  };
}

/** Применить изменения к объекту: бампит version и updatedAt. */
export function applyLifeObjectUpdate(
  current: LifeObject,
  patch: UpdateLifeObjectInput,
  now: Date = new Date(),
): LifeObject {
  const parsed = updateLifeObjectInputSchema.parse(patch);
  const ts = now.toISOString();
  return {
    ...current,
    ...parsed,
    updatedAt: ts,
    version: current.version + 1,
  };
}

/**
 * Сколько объект лежит в корзине, прежде чем исчезнуть окончательно. Данные на устройстве
 * единственные, поэтому удаление обязано быть обратимым хотя бы какое-то время.
 */
export const trashRetentionDays = 30;

/**
 * Убрать объект в корзину. Вложения при этом не трогаются — иначе восстанавливать было бы нечего:
 * документ без скана не тот же документ.
 */
export function softDeleteLifeObject(current: LifeObject, now: Date = new Date()): LifeObject {
  const ts = now.toISOString();
  return { ...current, deletedAt: ts, updatedAt: ts, version: current.version + 1 };
}

/** Вернуть объект из корзины. */
export function restoreLifeObject(current: LifeObject, now: Date = new Date()): LifeObject {
  const ts = now.toISOString();
  return { ...current, deletedAt: null, updatedAt: ts, version: current.version + 1 };
}

/** Отлежал ли объект в корзине свой срок и пора ли удалять его насовсем. */
export function trashExpired(
  obj: Pick<LifeObject, 'deletedAt'>,
  now: Date = new Date(),
  retentionDays: number = trashRetentionDays,
): boolean {
  if (!obj.deletedAt) return false;
  const deleted = new Date(obj.deletedAt).getTime();
  if (Number.isNaN(deleted)) return false;
  return now.getTime() - deleted > retentionDays * 86_400_000;
}

/** Сколько дней осталось до окончательного удаления. null — объект не в корзине. */
export function daysLeftInTrash(
  obj: Pick<LifeObject, 'deletedAt'>,
  now: Date = new Date(),
  retentionDays: number = trashRetentionDays,
): number | null {
  if (!obj.deletedAt) return null;
  const deleted = new Date(obj.deletedAt).getTime();
  if (Number.isNaN(deleted)) return null;
  const left = retentionDays * 86_400_000 - (now.getTime() - deleted);
  return Math.max(0, Math.ceil(left / 86_400_000));
}
