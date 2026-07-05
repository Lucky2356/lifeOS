import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/drizzle.provider';
import { sessions } from '../db/schema';
import type { Session, SessionRepository } from './session.repository';

export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(session: Session): Promise<Session> {
    await this.db.insert(sessions).values(session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return (rows[0] as Session | undefined) ?? null;
  }

  async save(session: Session): Promise<Session> {
    await this.db.update(sessions).set(session).where(eq(sessions.id, session.id));
    return session;
  }

  async listByUser(userId: string): Promise<Session[]> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .orderBy(desc(sessions.lastSeenAt));
    return rows as Session[];
  }
}
