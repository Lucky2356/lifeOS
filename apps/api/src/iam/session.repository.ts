import { Injectable } from '@nestjs/common';

export interface Session {
  id: string;
  userId: string;
  refreshHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
  userAgent: string;
}

export interface SessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  save(session: Session): Promise<Session>;
  listByUser(userId: string): Promise<Session[]>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

@Injectable()
export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    this.store.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.store.get(id) ?? null;
  }

  async save(session: Session): Promise<Session> {
    this.store.set(session.id, session);
    return session;
  }

  async listByUser(userId: string): Promise<Session[]> {
    return [...this.store.values()]
      .filter((s) => s.userId === userId && s.revokedAt === null)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }
}
