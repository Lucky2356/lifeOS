const ACCESS = 'los-access';
const REFRESH = 'los-refresh';
const USER = 'los-user';

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
  set(access: string, refresh: string, userId?: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
    if (userId) localStorage.setItem(USER, userId);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
  get isAuthenticated(): boolean {
    return this.access !== null;
  },
};
