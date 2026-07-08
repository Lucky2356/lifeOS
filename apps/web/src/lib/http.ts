import { authStore } from './auth-store';

/**
 * База API. В вебе — относительный путь (проксируется dev-сервером / nginx). В нативных оболочках
 * (Tauri/Capacitor) нет общего origin с бэкендом, поэтому адрес задаётся при сборке через
 * VITE_API_BASE (напр. http://localhost:3011/api/v1) либо переопределяется в рантайме (localStorage).
 */
const BASE =
  (typeof localStorage !== 'undefined' && localStorage.getItem('los-api-base')) ||
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  '/api/v1';

let unauthHandler: (() => void) | null = null;
export function setUnauthHandler(fn: () => void) {
  unauthHandler = fn;
}

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

/** Fetch с access-токеном и однократным авто-refresh при 401. Возвращает сырой Response. */
export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(`${BASE}${path}`, withAuth(init, authStore.access));

  if (res.status === 401 && authStore.refresh) {
    const r = await fetch(`${BASE}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: authStore.refresh }),
    });
    if (r.ok) {
      const data = (await r.json()) as { status: string; accessToken?: string; refreshToken?: string };
      if (data.status === 'authenticated' && data.accessToken && data.refreshToken) {
        authStore.set(data.accessToken, data.refreshToken);
        res = await fetch(`${BASE}${path}`, withAuth(init, data.accessToken));
      }
    }
  }

  if (res.status === 401) {
    authStore.clear();
    unauthHandler?.();
  }
  return res;
}

/** Как apiRequest, но парсит JSON и бросает на не-2xx. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest(path, init);
  if (!res.ok) throw new Error(`Запрос не удался (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
