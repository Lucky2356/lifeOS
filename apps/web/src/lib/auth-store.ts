const ACCESS = 'los-access';
const REFRESH = 'los-refresh';
const USER = 'los-user';
const LOCAL = 'los-local';

/**
 * Хранилище сессии. Поддерживает два режима:
 *  - аккаунт (access/refresh токены + userId) — с серверной синхронизацией;
 *  - локальный режим (`isLocal`) — без аккаунта и сервера, данные только на этом устройстве.
 * Локальный режим делает приложение пригодным сразу после установки, без запуска бэкенда.
 */
export const authStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH);
  },
  get userId(): string | null {
    return localStorage.getItem(USER);
  },
  get isLocal(): boolean {
    return localStorage.getItem(LOCAL) === '1';
  },
  set(access: string, refresh: string, userId?: string) {
    localStorage.removeItem(LOCAL);
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
    if (userId) localStorage.setItem(USER, userId);
  },
  /** Включить локальный режим с постоянным локальным идентификатором пользователя. */
  setLocal(userId: string) {
    localStorage.setItem(LOCAL, '1');
    localStorage.setItem(USER, userId);
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
    localStorage.removeItem(LOCAL);
  },
  get isAuthenticated(): boolean {
    return this.access !== null || this.isLocal;
  },
};
