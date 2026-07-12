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

/**
 * Single-flight refresh: параллельные запросы, получившие 401, ждут ОДИН общий refresh, а не дёргают
 * его каждый. Иначе refresh-секрет ротируется на сервере, и все, кроме первого, шлют устаревший
 * токен → 401 → неожиданный разлогин. Возвращает true, если refresh удался.
 */
let refreshing: Promise<boolean> | null = null;
function refreshOnce(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const token = authStore.refresh;
    if (!token) return false;
    const r = await fetch(`${BASE}/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!r.ok) return false;
    const data = (await r.json()) as { status: string; accessToken?: string; refreshToken?: string };
    if (data.status === 'authenticated' && data.accessToken && data.refreshToken) {
      authStore.set(data.accessToken, data.refreshToken);
      return true;
    }
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  // Для FormData не выставляем Content-Type — браузер сам добавит multipart boundary.
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  return {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

/** Fetch с access-токеном и однократным авто-refresh при 401. Возвращает сырой Response. */
export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  // Локальный режим: сервер не используется — сразу «сеть недоступна», работаем из кэша.
  if (authStore.isLocal) {
    return Promise.reject(new Error('local-mode'));
  }
  let res = await fetch(`${BASE}${path}`, withAuth(init, authStore.access));

  if (res.status === 401 && authStore.refresh) {
    const ok = await refreshOnce();
    if (ok) res = await fetch(`${BASE}${path}`, withAuth(init, authStore.access));
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
