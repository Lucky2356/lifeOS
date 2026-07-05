import { and, eq } from 'drizzle-orm';
import type { PlaybookProgress } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { playbookProgress } from '../db/schema';
import type { ProgressRepository } from './progress.repository';

type Row = typeof playbookProgress.$inferSelect;

function toDomain(row: Row): PlaybookProgress {
  return { ...row, stepStates: row.stepStates as Record<string, boolean> };
}

export class DrizzleProgressRepository implements ProgressRepository {
  constructor(private readonly db: Database) {}

  async create(p: PlaybookProgress): Promise<PlaybookProgress> {
    await this.db.insert(playbookProgress).values(p);
    return p;
  }

  async findById(id: string): Promise<PlaybookProgress | null> {
    const rows = await this.db.select().from(playbookProgress).where(eq(playbookProgress.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByOwnerAndKey(ownerUserId: string, playbookKey: string): Promise<PlaybookProgress | null> {
    const rows = await this.db
      .select()
      .from(playbookProgress)
      .where(
        and(eq(playbookProgress.ownerUserId, ownerUserId), eq(playbookProgress.playbookKey, playbookKey)),
      )
      .limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async listByOwner(ownerUserId: string): Promise<PlaybookProgress[]> {
    const rows = await this.db
      .select()
      .from(playbookProgress)
      .where(eq(playbookProgress.ownerUserId, ownerUserId));
    return rows.map(toDomain);
  }

  async save(p: PlaybookProgress): Promise<PlaybookProgress> {
    await this.db.update(playbookProgress).set(p).where(eq(playbookProgress.id, p.id));
    return p;
  }
}
