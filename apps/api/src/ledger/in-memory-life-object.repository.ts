import { Injectable } from '@nestjs/common';
import { initialHlc, type LifeObject } from '@life-os/domain';
import type { LifeObjectRepository } from './life-object.repository';

/** In-memory реализация репозитория — для локального запуска среза без Docker/Postgres. */
@Injectable()
export class InMemoryLifeObjectRepository implements LifeObjectRepository {
  private readonly store = new Map<string, LifeObject>();

  async create(obj: LifeObject): Promise<LifeObject> {
    this.store.set(obj.id, obj);
    return obj;
  }

  async findAllByOwner(ownerUserId: string): Promise<LifeObject[]> {
    return [...this.store.values()]
      .filter((o) => o.ownerUserId === ownerUserId && o.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string, ownerUserId: string): Promise<LifeObject | null> {
    const o = this.store.get(id);
    return o && o.ownerUserId === ownerUserId && o.deletedAt === null ? o : null;
  }

  async save(obj: LifeObject): Promise<LifeObject> {
    this.store.set(obj.id, obj);
    return obj;
  }

  async softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean> {
    const o = this.store.get(id);
    if (!o || o.ownerUserId !== ownerUserId || o.deletedAt !== null) return false;
    this.store.set(id, {
      ...o,
      deletedAt: now.toISOString(),
      hlc: initialHlc(now),
      version: o.version + 1,
    });
    return true;
  }
}
