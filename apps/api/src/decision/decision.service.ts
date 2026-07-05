import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  applyDecisionUpdate,
  createDecision,
  type CreateDecisionInput,
  type Decision,
  type UpdateDecisionInput,
} from '@life-os/domain';
import { DECISION_REPOSITORY, type DecisionRepository } from './decision.repository';

@Injectable()
export class DecisionService {
  constructor(@Inject(DECISION_REPOSITORY) private readonly repo: DecisionRepository) {}

  create(input: CreateDecisionInput, ownerUserId: string): Promise<Decision> {
    return this.repo.create(createDecision(input, ownerUserId));
  }

  list(ownerUserId: string): Promise<Decision[]> {
    return this.repo.findAllByOwner(ownerUserId);
  }

  async get(id: string, ownerUserId: string): Promise<Decision> {
    const d = await this.repo.findById(id, ownerUserId);
    if (!d) throw new NotFoundException('Решение не найдено');
    return d;
  }

  async update(id: string, patch: UpdateDecisionInput, ownerUserId: string): Promise<Decision> {
    const current = await this.get(id, ownerUserId);
    return this.repo.save(applyDecisionUpdate(current, patch));
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    const ok = await this.repo.softDelete(id, ownerUserId, new Date());
    if (!ok) throw new NotFoundException('Решение не найдено');
  }

  deleteAllForOwner(ownerUserId: string): Promise<number> {
    return this.repo.softDeleteAllByOwner(ownerUserId, new Date());
  }
}
