import { z } from 'zod';

/**
 * Sync-метаданные, которые несёт каждая пользовательская запись (ADR 0003).
 * Первичный ключ — UUIDv7 (сортируемый, безопасен при офлайн-создании);
 * hlc — гибридные логические часы для разрешения конфликтов; deleted_at — tombstone.
 */
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  hlc: z.string(),
  version: z.number().int().nonnegative(),
  deletedAt: z.string().datetime().nullable(),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;

/**
 * Заглушка HLC для первого среза: `<iso>-<counter>`. Настоящая реализация
 * гибридных логических часов появится вместе с sync-движком (см. ADR 0003).
 */
export function initialHlc(now: Date = new Date()): string {
  return `${now.toISOString()}-0000`;
}
