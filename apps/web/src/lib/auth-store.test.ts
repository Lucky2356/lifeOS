import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authStore } from './auth-store';

/** Переключить эмуляцию нативной оболочки (Tauri). */
function setNative(on: boolean) {
  const w = window as unknown as { __TAURI__?: unknown };
  if (on) w.__TAURI__ = {};
  else delete w.__TAURI__;
}

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setNative(false);
    authStore.clear();
  });
  afterEach(() => setNative(false));

  it('веб-режим: access в памяти, refresh НЕ в хранилище (cookie), признак сессии выставлен', () => {
    authStore.set('acc', 'rt-should-be-ignored-on-web', 'u1');
    expect(authStore.access).toBe('acc');
    expect(authStore.refresh).toBeNull(); // refresh — в httpOnly-cookie, недоступен JS
    expect(authStore.canRefresh).toBe(true);
    expect(authStore.userId).toBe('u1');
    expect(localStorage.getItem('los-access')).toBeNull();
    expect(localStorage.getItem('los-refresh')).toBeNull();
    expect(localStorage.getItem('los-session')).toBe('1');
  });

  it('веб-режим после перезагрузки: access потерян, но сессия жива → авторизованы, можно обновить', () => {
    // Симуляция: в памяти access нет, но признак сессии и userId сохранены.
    localStorage.setItem('los-session', '1');
    localStorage.setItem('los-user', 'u1');
    expect(authStore.access).toBeNull();
    expect(authStore.canRefresh).toBe(true);
    expect(authStore.isAuthenticated).toBe(true);
  });

  it('нативный режим: access и refresh хранятся в localStorage (Bearer)', () => {
    setNative(true);
    authStore.set('acc', 'rt', 'u1');
    expect(authStore.access).toBe('acc');
    expect(authStore.refresh).toBe('rt');
    expect(authStore.canRefresh).toBe(true);
    expect(localStorage.getItem('los-access')).toBe('acc');
    expect(localStorage.getItem('los-refresh')).toBe('rt');
    expect(localStorage.getItem('los-session')).toBeNull();
  });

  it('локальный режим: без сервера, но авторизованы; refresh невозможен', () => {
    authStore.setLocal('local-user');
    expect(authStore.isLocal).toBe(true);
    expect(authStore.userId).toBe('local-user');
    expect(authStore.access).toBeNull();
    expect(authStore.canRefresh).toBe(false);
    expect(authStore.isAuthenticated).toBe(true);
  });

  it('clear стирает всё', () => {
    authStore.set('acc', undefined, 'u1');
    authStore.clear();
    expect(authStore.access).toBeNull();
    expect(authStore.userId).toBeNull();
    expect(authStore.canRefresh).toBe(false);
    expect(authStore.isAuthenticated).toBe(false);
  });
});
