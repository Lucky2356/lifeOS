import {
  applyLifeObjectUpdate,
  createLifeObject,
  type CreateLifeObjectInput,
  type LifeObject,
  type UpdateLifeObjectInput,
} from '@life-os/domain';
import { apiFetch, apiRequest } from './http';
import { authStore } from './auth-store';

/**
 * Offline-first слой Life Ledger (ADR 0003): локальный кэш для чтения офлайн + очередь мутаций
 * (outbox), которая проигрывается на сервер через upsert по клиентскому id при возврате сети.
 * Разрешение конфликтов — LWW по version на сервере.
 */

const CACHE = 'los-objects-cache';
const OUTBOX = 'los-outbox';

type Op = { kind: 'upsert'; obj: LifeObject } | { kind: 'delete'; id: string };

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
function readOutbox(): Op[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? '[]') as Op[];
  } catch {
    return [];
  }
}
function writeOutbox(ops: Op[]) {
  localStorage.setItem(OUTBOX, JSON.stringify(ops));
}
function putLocal(obj: LifeObject) {
  const objs = readCache().filter((o) => o.id !== obj.id);
  if (obj.deletedAt === null) objs.unshift(obj);
  writeCache(objs);
}

const listeners = new Set<() => void>();
export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((f) => f());
}

export function pendingCount(): number {
  return readOutbox().length;
}
export function isOnline(): boolean {
  return navigator.onLine;
}

export const offlineLedger = {
  async list(): Promise<LifeObject[]> {
    try {
      const objs = await apiFetch<LifeObject[]>('/objects');
      writeCache(objs);
      return objs;
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
    const userId = authStore.userId ?? '00000000-0000-0000-0000-000000000000';
    const obj = createLifeObject(input, userId);
    putLocal(obj);
    writeOutbox([...readOutbox(), { kind: 'upsert', obj }]);
    notify();
    void offlineLedger.sync();
    return obj;
  },

  async update(id: string, patch: UpdateLifeObjectInput): Promise<LifeObject> {
    const current = readCache().find((o) => o.id === id);
    if (!current) throw new Error('Объект не найден в кэше');
    const updated = applyLifeObjectUpdate(current, patch);
    putLocal(updated);
    writeOutbox([...readOutbox(), { kind: 'upsert', obj: updated }]);
    notify();
    void offlineLedger.sync();
    return updated;
  },

  async remove(id: string): Promise<void> {
    writeCache(readCache().filter((o) => o.id !== id));
    writeOutbox([...readOutbox(), { kind: 'delete', id }]);
    notify();
    void offlineLedger.sync();
  },

  async sync(): Promise<void> {
    if (!navigator.onLine) return;
    const remaining: Op[] = [];
    for (const op of readOutbox()) {
      try {
        const res =
          op.kind === 'upsert'
            ? await apiRequest(`/objects/${op.obj.id}`, { method: 'PUT', body: JSON.stringify(op.obj) })
            : await apiRequest(`/objects/${op.id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) remaining.push(op);
      } catch {
        remaining.push(op);
      }
    }
    writeOutbox(remaining);
    notify();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void offlineLedger.sync();
  });
  // Периодическая попытка досинхронизировать очередь (сервер мог вернуться без offline-события).
  setInterval(() => {
    if (pendingCount() > 0) void offlineLedger.sync();
  }, 15_000);
}
