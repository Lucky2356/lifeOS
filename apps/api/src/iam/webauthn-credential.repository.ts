import { Injectable } from '@nestjs/common';

export interface WebauthnCredential {
  id: string;
  userId: string;
  credentialId: string; // base64url
  publicKey: string; // base64url COSE-ключа
  counter: number;
  transports: string[] | null;
  createdAt: string;
}

export interface WebauthnCredentialRepository {
  create(cred: WebauthnCredential): Promise<WebauthnCredential>;
  listByUser(userId: string): Promise<WebauthnCredential[]>;
  findByCredentialId(credentialId: string): Promise<WebauthnCredential | null>;
  updateCounter(id: string, counter: number): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}

export const WEBAUTHN_CREDENTIAL_REPOSITORY = Symbol('WEBAUTHN_CREDENTIAL_REPOSITORY');

@Injectable()
export class InMemoryWebauthnCredentialRepository implements WebauthnCredentialRepository {
  private readonly store = new Map<string, WebauthnCredential>();

  async create(cred: WebauthnCredential): Promise<WebauthnCredential> {
    this.store.set(cred.id, cred);
    return cred;
  }

  async listByUser(userId: string): Promise<WebauthnCredential[]> {
    return [...this.store.values()].filter((c) => c.userId === userId);
  }

  async findByCredentialId(credentialId: string): Promise<WebauthnCredential | null> {
    return [...this.store.values()].find((c) => c.credentialId === credentialId) ?? null;
  }

  async updateCounter(id: string, counter: number): Promise<void> {
    const c = this.store.get(id);
    if (c) this.store.set(id, { ...c, counter });
  }

  async deleteByUser(userId: string): Promise<void> {
    for (const [id, c] of this.store) if (c.userId === userId) this.store.delete(id);
  }
}
