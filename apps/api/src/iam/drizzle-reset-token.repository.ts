import { eq, lt, or, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/drizzle.provider';
import { passwordResetTokens } from '../db/schema';
import type { ResetToken, ResetTokenRepository } from './reset-token.repository';

export class DrizzleResetTokenRepository implements ResetTokenRepository {
  constructor(private readonly db: Database) {}

  async create(t: ResetToken): Promise<ResetToken> {
    await this.db.insert(passwordResetTokens).values(t);
    return t;
  }

  async findByHash(tokenHash: string): Promise<ResetToken | null> {
    const rows = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return (rows[0] as ResetToken | undefined) ?? null;
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: now.toISOString() })
      .where(eq(passwordResetTokens.id, id));
  }

  async deleteExpired(now: Date): Promise<number> {
    const rows = await this.db
      .delete(passwordResetTokens)
      .where(or(lt(passwordResetTokens.expiresAt, now.toISOString()), isNotNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    return rows.length;
  }
}
