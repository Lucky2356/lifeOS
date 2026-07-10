import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecretEnc: string | null;
  status: 'active';
  locale: string;
  createdAt: string;
  notifyEmail: boolean;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
  save(user: User): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    return [...this.store.values()].find((u) => u.email.toLowerCase() === normalized) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async create(user: User): Promise<User> {
    this.store.set(user.id, user);
    return user;
  }

  async save(user: User): Promise<User> {
    this.store.set(user.id, user);
    return user;
  }
}
