import { Injectable } from '@nestjs/common';
import type { PlaybookProgress } from '@life-os/domain';

export interface ProgressRepository {
  create(p: PlaybookProgress): Promise<PlaybookProgress>;
  findById(id: string): Promise<PlaybookProgress | null>;
  findByOwnerAndKey(ownerUserId: string, playbookKey: string): Promise<PlaybookProgress | null>;
  listByOwner(ownerUserId: string): Promise<PlaybookProgress[]>;
  save(p: PlaybookProgress): Promise<PlaybookProgress>;
}

export const PROGRESS_REPOSITORY = Symbol('PROGRESS_REPOSITORY');

@Injectable()
export class InMemoryProgressRepository implements ProgressRepository {
  private readonly store = new Map<string, PlaybookProgress>();

  async create(p: PlaybookProgress): Promise<PlaybookProgress> {
    this.store.set(p.id, p);
    return p;
  }

  async findById(id: string): Promise<PlaybookProgress | null> {
    return this.store.get(id) ?? null;
  }

  async findByOwnerAndKey(ownerUserId: string, playbookKey: string): Promise<PlaybookProgress | null> {
    return (
      [...this.store.values()].find((p) => p.ownerUserId === ownerUserId && p.playbookKey === playbookKey) ??
      null
    );
  }

  async listByOwner(ownerUserId: string): Promise<PlaybookProgress[]> {
    return [...this.store.values()].filter((p) => p.ownerUserId === ownerUserId);
  }

  async save(p: PlaybookProgress): Promise<PlaybookProgress> {
    this.store.set(p.id, p);
    return p;
  }
}
