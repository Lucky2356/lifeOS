import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AuditEntry, Household, HouseholdTask, Membership } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { auditEntries, householdTasks, households, memberships } from '../db/schema';
import type { HouseholdRepository } from './household.repository';

export class DrizzleHouseholdRepository implements HouseholdRepository {
  constructor(private readonly db: Database) {}

  async createHousehold(h: Household): Promise<Household> {
    await this.db.insert(households).values(h);
    return h;
  }

  async getHousehold(id: string): Promise<Household | null> {
    const rows = await this.db.select().from(households).where(eq(households.id, id)).limit(1);
    return (rows[0] as Household | undefined) ?? null;
  }

  async addMembership(m: Membership): Promise<Membership> {
    await this.db.insert(memberships).values(m);
    return m;
  }

  async listMemberships(householdId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.householdId, householdId), isNull(memberships.deletedAt)));
    return rows as Membership[];
  }

  async findMembership(householdId: string, userId: string): Promise<Membership | null> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.householdId, householdId),
          eq(memberships.userId, userId),
          isNull(memberships.deletedAt),
        ),
      )
      .limit(1);
    return (rows[0] as Membership | undefined) ?? null;
  }

  async listMembershipsByUser(userId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)));
    return rows as Membership[];
  }

  async deactivateMembershipsByUser(userId: string, now: Date): Promise<number> {
    const rows = await this.db
      .update(memberships)
      .set({ deletedAt: now.toISOString(), version: sql`${memberships.version} + 1` })
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)))
      .returning({ id: memberships.id });
    return rows.length;
  }

  async createTask(t: HouseholdTask): Promise<HouseholdTask> {
    await this.db.insert(householdTasks).values(t);
    return t;
  }

  async listTasks(householdId: string): Promise<HouseholdTask[]> {
    const rows = await this.db
      .select()
      .from(householdTasks)
      .where(and(eq(householdTasks.householdId, householdId), isNull(householdTasks.deletedAt)))
      .orderBy(asc(householdTasks.createdAt));
    return rows as HouseholdTask[];
  }

  async getTask(householdId: string, id: string): Promise<HouseholdTask | null> {
    const rows = await this.db
      .select()
      .from(householdTasks)
      .where(
        and(
          eq(householdTasks.id, id),
          eq(householdTasks.householdId, householdId),
          isNull(householdTasks.deletedAt),
        ),
      )
      .limit(1);
    return (rows[0] as HouseholdTask | undefined) ?? null;
  }

  async saveTask(t: HouseholdTask): Promise<HouseholdTask> {
    await this.db.update(householdTasks).set(t).where(eq(householdTasks.id, t.id));
    return t;
  }

  async addAudit(e: AuditEntry): Promise<AuditEntry> {
    await this.db.insert(auditEntries).values(e);
    return e;
  }

  async listAudit(householdId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.householdId, householdId))
      .orderBy(desc(auditEntries.at));
    return rows as AuditEntry[];
  }
}
