import { apiRequest } from './http';
import { authStore } from './auth-store';

/**
 * Общий offline-движок для всех модулей (ADR 0003): единая очередь мутаций (outbox) в
 * localStorage, проигрываемая на сервер через идемпотентные upsert/delete по клиентскому id
 * при возврате сети. Каждый модуль хранит свой кэш для чтения офлайн и кладёт сюда операции.
 * Разрешение конфликтов — LWW на сервере (по version там, где оно есть).
 */

export const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export type OutboxOp = {
  /** Путь однозначно идентифицирует целевой ресурс и служит ключом дедупликации. */
  path: string;
  method: 'PUT' | 'DELETE';
  body?: string;
};

const OUTBOX = 'los-outbox';

function readOutbox(): OutboxOp[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? '[]') as OutboxOp[];
  } catch {
    return [];
  }
}
function writeOutbox(ops: OutboxOp[]) {
  localStorage.setItem(OUTBOX, JSON.stringify(ops));
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
/** Пути ресурсов с неотправленными мутациями — чтобы не затирать оптимистичные записи при list(). */
export function pendingPaths(): Set<string> {
  return new Set(readOutbox().map((o) => o.path));
}
export function isOnline(): boolean {
  return navigator.onLine;
}
export function currentUserId(): string {
  return authStore.userId ?? ZERO_UUID;
}

/**
 * Поставить операцию в очередь. Операции к одному пути схлопываются (последняя побеждает):
 * повторные правки одного объекта офлайн не копятся, а DELETE отменяет прежний upsert.
 */
export function enqueue(op: OutboxOp) {
  const ops = readOutbox().filter((o) => o.path !== op.path);
  ops.push(op);
  writeOutbox(ops);
  notify();
  void sync();
}

export async function sync(): Promise<void> {
  // В локальном режиме сервера нет — очередь просто ждёт (переиграется, если создадут аккаунт).
  if (authStore.isLocal || !navigator.onLine) return;
  const remaining: OutboxOp[] = [];
  for (const op of readOutbox()) {
    try {
      const res = await apiRequest(op.path, { method: op.method, body: op.body });
      // Успех или «уже нет на сервере» (404) — операцию можно снять с очереди.
      if (!res.ok && res.status !== 404) remaining.push(op);
    } catch {
      remaining.push(op);
    }
  }
  writeOutbox(remaining);
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void sync();
  });
  // Сервер мог вернуться без события online — периодически дожимаем очередь.
  setInterval(() => {
    if (pendingCount() > 0) void sync();
  }, 15_000);
}
