import {
  applyLifeObjectUpdate,
  createLifeObject,
  type CreateLifeObjectInput,
  type LifeObject,
  type UpdateLifeObjectInput,
} from '@life-os/domain';
import { apiFetch } from './http';
import { currentUserId, enqueue, pendingPaths, sync } from './offline-core';

/**
 * Offline-first слой Life Ledger (ADR 0003): локальный кэш для чтения офлайн + общая очередь
 * мутаций (offline-core), проигрываемая на сервер через upsert по клиентскому id при возврате сети.
 */

const CACHE = 'los-objects-cache';

function readCache(): LifeObject[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '[]') as LifeObject[];
  } catch {
    return [];
  }
}
function writeCache(objs: LifeObject[]) {
  localStorage.setItem(CACHE, JSON.stringify(objs));
}
function putLocal(obj: LifeObject) {
  const objs = readCache().filter((o) => o.id !== obj.id);
  if (obj.deletedAt === null) objs.unshift(obj);
  writeCache(objs);
}

export const offlineLedger = {
  async list(): Promise<LifeObject[]> {
    try {
      const server = await apiFetch<LifeObject[]>('/objects');
      // Не теряем ещё не синхронизированные локальные правки при обновлении из сети. Любой объект с
      // неотправленной мутацией берём из локального кэша (pending PUT) или прячем (pending DELETE —
      // его нет в кэше), а серверную копию для таких путей игнорируем, иначе удалённое офлайн вернётся.
      const pending = pendingPaths();
      const keep = readCache().filter((o) => pending.has(`/objects/${o.id}`));
      const merged = [...keep, ...server.filter((s) => !pending.has(`/objects/${s.id}`))];
      writeCache(merged);
      return merged;
    } catch {
      return readCache();
    }
  },

  async get(id: string): Promise<LifeObject | null> {
    try {
      const obj = await apiFetch<LifeObject>(`/objects/${id}`);
      putLocal(obj);
      return obj;
    } catch {
      return readCache().find((o) => o.id === id) ?? null;
    }
  },

  async create(input: CreateLifeObjectInput): Promise<LifeObject> {
    const obj = createLifeObject(input, currentUserId());
    putLocal(obj);
    enqueue({ path: `/objects/${obj.id}`, method: 'PUT', body: JSON.stringify(obj) });
    return obj;
  },

  async update(id: string, patch: UpdateLifeObjectInput): Promise<LifeObject> {
    const current = readCache().find((o) => o.id === id);
    if (!current) throw new Error('Объект не найден в кэше');
    const updated = applyLifeObjectUpdate(current, patch);
    putLocal(updated);
    enqueue({ path: `/objects/${updated.id}`, method: 'PUT', body: JSON.stringify(updated) });
    return updated;
  },

  async remove(id: string): Promise<void> {
    writeCache(readCache().filter((o) => o.id !== id));
    enqueue({ path: `/objects/${id}`, method: 'DELETE' });
  },

  sync,
};

// Ре-экспорт для существующих импортов индикатора синхронизации.
export { isOnline, pendingCount, subscribeSync } from './offline-core';
