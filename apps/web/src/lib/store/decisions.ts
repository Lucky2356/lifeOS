import {
  applyDecisionUpdate,
  createDecision,
  type CreateDecisionInput,
  type Decision,
  type UpdateDecisionInput,
} from '@life-os/domain';
import { db } from './db';
import { ownerUserId } from './local-user';

/** Журнал решений на устройстве. Взвешенный подсчёт — доменный scoreOptions, здесь только хранение. */

export const decisionsStore = {
  async list(): Promise<Decision[]> {
    const all = await (await db()).getAll('decisions');
    return all.filter((d) => d.deletedAt === null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<Decision | null> {
    const d = await (await db()).get('decisions', id);
    return d && d.deletedAt === null ? d : null;
  },

  async create(input: CreateDecisionInput): Promise<Decision> {
    const decision = createDecision(input, await ownerUserId());
    await (await db()).put('decisions', decision);
    return decision;
  },

  async update(id: string, patch: UpdateDecisionInput): Promise<Decision> {
    const database = await db();
    const current = await database.get('decisions', id);
    if (!current) throw new Error('Решение не найдено');
    const updated = applyDecisionUpdate(current, patch);
    await database.put('decisions', updated);
    return updated;
  },

  async remove(id: string): Promise<void> {
    await (await db()).delete('decisions', id);
  },
};
