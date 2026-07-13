import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, pendingCount, pendingPaths } from './offline-core';

describe('offline-core — очередь мутаций (outbox)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('los-local', '1'); // локальный режим → sync() не ходит в сеть
  });

  it('повторные правки одного пути схлопываются (последняя побеждает)', () => {
    enqueue({ path: '/objects/A', method: 'PUT', body: '1' });
    enqueue({ path: '/objects/A', method: 'PUT', body: '2' });
    expect(pendingCount()).toBe(1);
    const stored = JSON.parse(localStorage.getItem('los-outbox') ?? '[]') as Array<{ body?: string }>;
    expect(stored[0]?.body).toBe('2');
  });

  it('DELETE отменяет прежний upsert того же пути', () => {
    enqueue({ path: '/objects/A', method: 'PUT', body: '1' });
    enqueue({ path: '/objects/A', method: 'DELETE' });
    expect(pendingCount()).toBe(1);
    const stored = JSON.parse(localStorage.getItem('los-outbox') ?? '[]') as Array<{ method: string }>;
    expect(stored[0]?.method).toBe('DELETE');
  });

  it('разные пути копятся отдельно; pendingPaths их перечисляет', () => {
    enqueue({ path: '/objects/A', method: 'PUT', body: '1' });
    enqueue({ path: '/objects/B', method: 'PUT', body: '1' });
    expect(pendingCount()).toBe(2);
    const paths = pendingPaths();
    expect(paths.has('/objects/A')).toBe(true);
    expect(paths.has('/objects/B')).toBe(true);
  });
});
