import { z } from 'zod';

/**
 * Метаданные, которые несёт каждая пользовательская запись. Первичный ключ — UUIDv7
 * (сортируемый по времени), version растёт при каждой правке, deletedAt — tombstone.
 * Приложение локальное (ADR 0006): version/tombstone нужны для импорта резервных копий,
 * а не для синхронизации с сервером.
 */
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().nonnegative(),
  deletedAt: z.string().datetime().nullable(),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;
