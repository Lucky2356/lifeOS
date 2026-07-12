const ACCESS = 'los-access';
const REFRESH = 'los-refresh';
const USER = 'los-user';
const LOCAL = 'los-local';
const SESSION = 'los-session'; // веб: признак активной сессии (сам refresh — в httpOnly-cookie)

/**
 * Нативная оболочка (Tauri/Capacitor). Там куки-режим неудобен (свой протокол/origin), поэтому
 * используем Bearer: access/refresh хранятся в localStorage приложения. В обычном вебе refresh лежит
 * в httpOnly-cookie (JS его не видит — защита от кражи при XSS), а access держим только в памяти.
 */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown; Capacitor?: unknown };
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__ || w.Capacitor);
}

let memAccess: string | null = null; // access-токен в памяти (веб) — не персистим

/**
 * Хранилище сессии. Три режима:
 *  - веб-аккаунт: access в памяти, refresh в httpOnly-cookie, признак сессии в localStorage;
 *  - нативный аккаунт: access/refresh в localStorage (Bearer);
 *  - локальный режим (`isLocal`) — без аккаунта и сервера, данные только на этом устройстве.
 */
export const authStore = {
  get access(): string | null {
    return isNativeShell() ? localStorage.getItem(ACCESS) : memAccess;
  },
  get refresh(): string | null {
    // Веб: refresh недоступен JS (cookie). Нативный: из localStorage.
    return isNativeShell() ? localStorage.getItem(REFRESH) : null;
  },
  /** Есть ли основание пытаться обновить сессию: нативный — есть refresh; веб — есть признак сессии. */
  get canRefresh(): boolean {
    return isNativeShell() ? this.refresh !== null : localStorage.getItem(SESSION) === '1';
  },
  get userId(): string | null {
    return localStorage.getItem(USER);
  },
  get isLocal(): boolean {
    return localStorage.getItem(LOCAL) === '1';
  },
  set(access: string, refresh?: string, userId?: string) {
    localStorage.removeItem(LOCAL);
    if (userId) localStorage.setItem(USER, userId);
    if (isNativeShell()) {
      localStorage.setItem(ACCESS, access);
      if (refresh) localStorage.setItem(REFRESH, refresh);
    } else {
      // Веб: access — только в памяти; refresh пришёл в cookie; фиксируем факт сессии.
      memAccess = access;
      localStorage.setItem(SESSION, '1');
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
    }
  },
  /** Включить локальный режим с постоянным локальным идентификатором пользователя. */
  setLocal(userId: string) {
    localStorage.setItem(LOCAL, '1');
    localStorage.setItem(USER, userId);
    memAccess = null;
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(SESSION);
  },
  clear() {
    memAccess = null;
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
    localStorage.removeItem(LOCAL);
    localStorage.removeItem(SESSION);
  },
  get isAuthenticated(): boolean {
    // Веб после перезагрузки: access ещё нет в памяти, но есть признак сессии — считаем
    // авторизованными оптимистично; первый запрос обновит access по cookie (или уронит в логин).
    return this.access !== null || this.isLocal || this.canRefresh;
  },
};
