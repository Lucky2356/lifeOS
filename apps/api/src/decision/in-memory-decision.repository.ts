import { Injectable } from '@nestjs/common';
import { initialHlc, type Decision } from '@life-os/domain';
import type { DecisionRepository } from './decision.repository';

@Injectable()
export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly store = new Map<string, Decision>();

  async create(d: Decision): Promise<Decision> {
    this.store.set(d.id, d);
    return d;
  }

  async findAllByOwner(ownerUserId: string): Promise<Decision[]> {
    return [...this.store.values()]
      .filter((d) => d.ownerUserId === ownerUserId && d.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string, ownerUserId: string): Promise<Decision | null> {
    const d = this.store.get(id);
    return d && d.ownerUserId === ownerUserId && d.deletedAt === null ? d : null;
  }

  async save(d: Decision): Promise<Decision> {
    this.store.set(d.id, d);
    return d;
  }

  async softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean> {
    const d = this.store.get(id);
    if (!d || d.ownerUserId !== ownerUserId || d.deletedAt !== null) return false;
    this.store.set(id, { ...d, deletedAt: now.toISOString(), hlc: initialHlc(now), version: d.version + 1 });
    return true;
  }
}
