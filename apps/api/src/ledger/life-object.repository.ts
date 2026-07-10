import type { LifeObject } from '@life-os/domain';

/**
 * Порт репозитория Life Ledger (ADR 0002). Реализации подключаются через DI-токен:
 * in-memory (для локального запуска без БД) и Drizzle/PostgreSQL (swap-in, тот же контракт).
 * Все методы принимают ownerUserId — изоляция на уровне строки (baby-RLS до Postgres RLS).
 */
export interface LifeObjectRepository {
  create(obj: LifeObject): Promise<LifeObject>;
  findAllByOwner(ownerUserId: string): Promise<LifeObject[]>;
  findById(id: string, ownerUserId: string): Promise<LifeObject | null>;
  /** Поиск по id без owner-фильтра — для проверки владельца при offline-upsert. */
  findByIdUnscoped(id: string): Promise<LifeObject | null>;
  /** Все живые объекты с дедлайном (validUntil) по всем владельцам — для движка напоминаний. */
  findAllWithDeadline(): Promise<LifeObject[]>;
  save(obj: LifeObject): Promise<LifeObject>;
  softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean>;
  softDeleteAllByOwner(ownerUserId: string, now: Date): Promise<number>;
}

export const LIFE_OBJECT_REPOSITORY = Symbol('LIFE_OBJECT_REPOSITORY');
