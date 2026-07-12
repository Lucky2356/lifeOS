import { Injectable } from '@nestjs/common';

export interface ResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface ResetTokenRepository {
  create(t: ResetToken): Promise<ResetToken>;
  findByHash(tokenHash: string): Promise<ResetToken | null>;
  markUsed(id: string, now: Date): Promise<void>;
  /** Удалить протухшие/использованные токены (expiresAt < now или usedAt != null). Возвращает число. */
  deleteExpired(now: Date): Promise<number>;
}

export const RESET_TOKEN_REPOSITORY = Symbol('RESET_TOKEN_REPOSITORY');

@Injectable()
export class InMemoryResetTokenRepository implements ResetTokenRepository {
  private readonly store = new Map<string, ResetToken>();

  async create(t: ResetToken): Promise<ResetToken> {
    this.store.set(t.id, t);
    return t;
  }

  async findByHash(tokenHash: string): Promise<ResetToken | null> {
    return [...this.store.values()].find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async markUsed(id: string, now: Date): Promise<void> {
    const t = this.store.get(id);
    if (t) this.store.set(id, { ...t, usedAt: now.toISOString() });
  }

  async deleteExpired(now: Date): Promise<number> {
    const iso = now.toISOString();
    let n = 0;
    for (const [id, t] of this.store) {
      if (t.usedAt !== null || t.expiresAt < iso) {
        this.store.delete(id);
        n += 1;
      }
    }
    return n;
  }
}
