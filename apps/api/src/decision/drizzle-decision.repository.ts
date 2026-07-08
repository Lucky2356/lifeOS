import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { initialHlc, type Decision } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { decisions } from '../db/schema';
import type { DecisionRepository } from './decision.repository';

export class DrizzleDecisionRepository implements DecisionRepository {
  constructor(private readonly db: Database) {}

  async create(d: Decision): Promise<Decision> {
    await this.db.insert(decisions).values(d);
    return d;
  }

  async findAllByOwner(ownerUserId: string): Promise<Decision[]> {
    const rows = await this.db
      .select()
      .from(decisions)
      .where(and(eq(decisions.ownerUserId, ownerUserId), isNull(decisions.deletedAt)))
      .orderBy(desc(decisions.createdAt));
    return rows as Decision[];
  }

  async findById(id: string, ownerUserId: string): Promise<Decision | null> {
    const rows = await this.db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.ownerUserId, ownerUserId), isNull(decisions.deletedAt)))
      .limit(1);
    return (rows[0] as Decision | undefined) ?? null;
  }

  async findByIdUnscoped(id: string): Promise<Decision | null> {
    const rows = await this.db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
    return (rows[0] as Decision | undefined) ?? null;
  }

  async save(d: Decision): Promise<Decision> {
    await this.db.update(decisions).set(d).where(eq(decisions.id, d.id));
    return d;
  }

  async softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean> {
    const existing = await this.findById(id, ownerUserId);
    if (!existing) return false;
    await this.db
      .update(decisions)
      .set({ deletedAt: now.toISOString(), hlc: initialHlc(now), version: existing.version + 1 })
      .where(eq(decisions.id, id));
    return true;
  }

  async softDeleteAllByOwner(ownerUserId: string, now: Date): Promise<number> {
    const rows = await this.db
      .update(decisions)
      .set({ deletedAt: now.toISOString(), hlc: initialHlc(now), version: sql`${decisions.version} + 1` })
      .where(and(eq(decisions.ownerUserId, ownerUserId), isNull(decisions.deletedAt)))
      .returning({ id: decisions.id });
    return rows.length;
  }
}
