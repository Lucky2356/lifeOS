const ACCESS = 'los-access';
const REFRESH = 'los-refresh';

export const authStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
  get isAuthenticated(): boolean {
    return this.access !== null;
  },
};
