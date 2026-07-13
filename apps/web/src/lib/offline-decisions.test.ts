import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Decision } from '@life-os/domain';
import { offlineDecisions } from './offline-decisions';

const dec = (id: string, title = id): Decision => ({ id, title }) as unknown as Decision;
const resp = (body: unknown) => ({ status: 200, ok: true, json: async () => body });

describe('offlineDecisions — слияние сети и офлайн-очереди', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('los-session', '1');
    localStorage.setItem('los-user', 'u1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('решение, удалённое офлайн, не возвращается сервером до синхронизации', async () => {
    localStorage.setItem('los-decisions-cache', JSON.stringify([dec('B')]));
    localStorage.setItem('los-outbox', JSON.stringify([{ path: '/decisions/A', method: 'DELETE' }]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resp([dec('A'), dec('B')])),
    );

    const list = await offlineDecisions.list();
    expect(list.map((d) => d.id).sort()).toEqual(['B']);
  });

  it('get() с pending-правкой отдаёт локальную версию и не ходит в сеть', async () => {
    localStorage.setItem('los-decisions-cache', JSON.stringify([dec('A', 'локально-изменён')]));
    localStorage.setItem('los-outbox', JSON.stringify([{ path: '/decisions/A', method: 'PUT', body: '{}' }]));
    const fetchMock = vi.fn(async () => resp(dec('A', 'старое-с-сервера')));
    vi.stubGlobal('fetch', fetchMock);

    const got = await offlineDecisions.get('A');
    expect(got?.title).toBe('локально-изменён');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
