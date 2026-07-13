import { eq } from 'drizzle-orm';
import type { Database } from '../db/drizzle.provider';
import { webauthnCredentials } from '../db/schema';
import type { WebauthnCredential, WebauthnCredentialRepository } from './webauthn-credential.repository';

export class DrizzleWebauthnCredentialRepository implements WebauthnCredentialRepository {
  constructor(private readonly db: Database) {}

  async create(cred: WebauthnCredential): Promise<WebauthnCredential> {
    await this.db.insert(webauthnCredentials).values(cred);
    return cred;
  }

  async listByUser(userId: string): Promise<WebauthnCredential[]> {
    const rows = await this.db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId));
    return rows as WebauthnCredential[];
  }

  async findByCredentialId(credentialId: string): Promise<WebauthnCredential | null> {
    const rows = await this.db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .limit(1);
    return (rows[0] as WebauthnCredential | undefined) ?? null;
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    await this.db.update(webauthnCredentials).set({ counter }).where(eq(webauthnCredentials.id, id));
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
  }
}
