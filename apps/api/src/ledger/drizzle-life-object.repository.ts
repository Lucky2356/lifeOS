import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { initialHlc, lifeObjectSchema, type LifeObject } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { lifeObjects } from '../db/schema';
import type { LifeObjectRepository } from './life-object.repository';

type Row = typeof lifeObjects.$inferSelect;

function toDomain(row: Row): LifeObject {
  return lifeObjectSchema.parse(row);
}

function toRow(o: LifeObject): typeof lifeObjects.$inferInsert {
  return {
    id: o.id,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    hlc: o.hlc,
    version: o.version,
    deletedAt: o.deletedAt,
    ownerUserId: o.ownerUserId,
    householdId: o.householdId,
    type: o.type,
    title: o.title,
    data: o.data,
    status: o.status,
    sensitivity: o.sensitivity,
    validFrom: o.validFrom,
    validUntil: o.validUntil,
  };
}

/** PostgreSQL/Drizzle реализация порта репозитория (swap-in вместо in-memory). */
export class DrizzleLifeObjectRepository implements LifeObjectRepository {
  constructor(private readonly db: Database) {}

  async create(obj: LifeObject): Promise<LifeObject> {
    await this.db.insert(lifeObjects).values(toRow(obj));
    return obj;
  }

  async findAllByOwner(ownerUserId: string): Promise<LifeObject[]> {
    const rows = await this.db
      .select()
      .from(lifeObjects)
      .where(and(eq(lifeObjects.ownerUserId, ownerUserId), isNull(lifeObjects.deletedAt)))
      .orderBy(desc(lifeObjects.createdAt));
    return rows.map(toDomain);
  }

  async findById(id: string, ownerUserId: string): Promise<LifeObject | null> {
    const rows = await this.db
      .select()
      .from(lifeObjects)
      .where(
        and(eq(lifeObjects.id, id), eq(lifeObjects.ownerUserId, ownerUserId), isNull(lifeObjects.deletedAt)),
      )
      .limit(1);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async findByIdUnscoped(id: string): Promise<LifeObject | null> {
    const rows = await this.db.select().from(lifeObjects).where(eq(lifeObjects.id, id)).limit(1);
    const row = rows[0];
    return row ? toDomain(row) : null;
  }

  async save(obj: LifeObject): Promise<LifeObject> {
    await this.db.update(lifeObjects).set(toRow(obj)).where(eq(lifeObjects.id, obj.id));
    return obj;
  }

  async softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean> {
    const existing = await this.findById(id, ownerUserId);
    if (!existing) return false;
    await this.db
      .update(lifeObjects)
      .set({ deletedAt: now.toISOString(), hlc: initialHlc(now), version: existing.version + 1 })
      .where(eq(lifeObjects.id, id));
    return true;
  }

  async softDeleteAllByOwner(ownerUserId: string, now: Date): Promise<number> {
    const rows = await this.db
      .update(lifeObjects)
      .set({ deletedAt: now.toISOString(), hlc: initialHlc(now), version: sql`${lifeObjects.version} + 1` })
      .where(and(eq(lifeObjects.ownerUserId, ownerUserId), isNull(lifeObjects.deletedAt)))
      .returning({ id: lifeObjects.id });
    return rows.length;
  }
}
