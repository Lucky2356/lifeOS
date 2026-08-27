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
