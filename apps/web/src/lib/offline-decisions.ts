import {
  applyDecisionUpdate,
  createDecision,
  type CreateDecisionInput,
  type Decision,
  type UpdateDecisionInput,
} from '@life-os/domain';
import { apiFetch } from './http';
import { currentUserId, enqueue, pendingPaths } from './offline-core';

/** Offline-first слой Decision Companion (ADR 0003), тот же паттерн, что и Ledger. */

const CACHE = 'los-decisions-cache';

function readCache(): Decision[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '[]') as Decision[];
  } catch {
    return [];
  }
}
function writeCache(list: Decision[]) {
  localStorage.setItem(CACHE, JSON.stringify(list));
}
function putLocal(d: Decision) {
  const list = readCache().filter((x) => x.id !== d.id);
  if (d.deletedAt === null) list.unshift(d);
  writeCache(list);
}

export const offlineDecisions = {
  async list(): Promise<Decision[]> {
    try {
      const server = await apiFetch<Decision[]>('/decisions');
      const pending = pendingPaths();
      const keep = readCache().filter((d) => pending.has(`/decisions/${d.id}`));
      const merged = [...keep, ...server.filter((s) => !keep.some((k) => k.id === s.id))];
      writeCache(merged);
      return merged;
    } catch {
      return readCache();
    }
  },

  async get(id: string): Promise<Decision | null> {
    try {
      const d = await apiFetch<Decision>(`/decisions/${id}`);
      putLocal(d);
      return d;
    } catch {
      return readCache().find((x) => x.id === id) ?? null;
    }
  },

  async create(input: CreateDecisionInput): Promise<Decision> {
    const d = createDecision(input, currentUserId());
    putLocal(d);
    enqueue({ path: `/decisions/${d.id}`, method: 'PUT', body: JSON.stringify(d) });
    return d;
  },

  async update(id: string, patch: UpdateDecisionInput): Promise<Decision> {
    const current = readCache().find((x) => x.id === id);
    if (!current) throw new Error('Решение не найдено в кэше');
    const updated = applyDecisionUpdate(current, patch);
    putLocal(updated);
    enqueue({ path: `/decisions/${updated.id}`, method: 'PUT', body: JSON.stringify(updated) });
    return updated;
  },

  async remove(id: string): Promise<void> {
    writeCache(readCache().filter((x) => x.id !== id));
    enqueue({ path: `/decisions/${id}`, method: 'DELETE' });
  },
};
