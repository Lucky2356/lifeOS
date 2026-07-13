import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiRequest } from './http';
import { authStore } from './auth-store';

type FakeResponse = { status: number; ok: boolean; json: () => Promise<unknown> };
const resp = (status: number, body: unknown = {}): FakeResponse => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

describe('apiRequest — single-flight refresh (веб)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Веб-режим с активной сессией (refresh — в cookie), но без access в памяти.
    authStore.clear();
    localStorage.setItem('los-session', '1');
    localStorage.setItem('los-user', 'u1');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('параллельные 401 запускают ОДИН refresh, затем повторяют запрос', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/token/refresh')) {
        refreshCalls += 1;
        // имитируем ротацию: access выдаётся, refresh уходит в cookie (не в теле)
        return resp(200, { status: 'authenticated', accessToken: `acc-${refreshCalls}` });
      }
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return headers.Authorization ? resp(200, { ok: true }) : resp(401);
    });
    vi.stubGlobal('fetch', fetchMock);

    // два параллельных запроса, оба стартуют без access → оба получат 401
    const [a, b] = await Promise.all([apiRequest('/objects'), apiRequest('/decisions')]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(refreshCalls).toBe(1); // единый refresh на оба 401, а не по одному на каждый
    expect(authStore.access).toBe('acc-1'); // новый access сохранён в памяти
  });

  it('неуспешный refresh → чистит сессию и отдаёт 401', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/token/refresh') ? resp(401) : resp(401),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await apiRequest('/objects');
    expect(res.status).toBe(401);
    expect(authStore.canRefresh).toBe(false); // сессия очищена
  });

  it('локальный режим: сервер не дёргается', async () => {
    authStore.setLocal('u1');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/objects')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
