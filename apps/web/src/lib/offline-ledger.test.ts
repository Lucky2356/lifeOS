import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LifeObject } from '@life-os/domain';
import { offlineLedger } from './offline-ledger';

const obj = (id: string, title = id): LifeObject => ({ id, title }) as unknown as LifeObject;
const resp = (body: unknown) => ({ status: 200, ok: true, json: async () => body });

describe('offlineLedger.list — слияние сети и офлайн-очереди', () => {
  beforeEach(() => {
    localStorage.clear();
    // веб-сессия (не локальный режим), чтобы apiFetch ходил в «сеть» (мок)
    localStorage.setItem('los-session', '1');
    localStorage.setItem('los-user', 'u1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('объект, удалённый офлайн, НЕ возвращается сервером до синхронизации', async () => {
    localStorage.setItem('los-objects-cache', JSON.stringify([obj('B')]));
    localStorage.setItem('los-outbox', JSON.stringify([{ path: '/objects/A', method: 'DELETE' }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resp([obj('A'), obj('B')])), // сервер ещё знает про A
    );

    const list = await offlineLedger.list();
    expect(list.map((o) => o.id).sort()).toEqual(['B']); // A спрятан (pending DELETE)
  });

  it('локальная несинхронизированная правка побеждает серверную версию', async () => {
    localStorage.setItem('los-objects-cache', JSON.stringify([obj('A', 'локально-изменён')]));
    localStorage.setItem('los-outbox', JSON.stringify([{ path: '/objects/A', method: 'PUT', body: '{}' }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resp([obj('A', 'старое-с-сервера')])),
    );

    const list = await offlineLedger.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('локально-изменён');
  });
});
