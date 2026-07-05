import type { Decision } from '@life-os/domain';

export interface DecisionRepository {
  create(d: Decision): Promise<Decision>;
  findAllByOwner(ownerUserId: string): Promise<Decision[]>;
  findById(id: string, ownerUserId: string): Promise<Decision | null>;
  save(d: Decision): Promise<Decision>;
  softDelete(id: string, ownerUserId: string, now: Date): Promise<boolean>;
  softDeleteAllByOwner(ownerUserId: string, now: Date): Promise<number>;
}

export const DECISION_REPOSITORY = Symbol('DECISION_REPOSITORY');
