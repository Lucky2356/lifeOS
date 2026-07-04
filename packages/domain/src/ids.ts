import { v7 as uuidv7 } from 'uuid';

/** Новый идентификатор сущности — UUIDv7 (сортируемый по времени, ADR 0003). */
export function newId(): string {
  return uuidv7();
}
