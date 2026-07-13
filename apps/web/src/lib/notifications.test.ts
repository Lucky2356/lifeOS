import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LifeObject } from '@life-os/domain';
import { syncReminderNotifications } from './notifications';

const shown: string[] = [];

class FakeNotification {
  static permission = 'granted';
  static requestPermission = async () => 'granted';
  constructor(title: string) {
    shown.push(title);
  }
}

/** Объект с дедлайном через `days` дней. */
function objDue(days: number, validUntil?: string): LifeObject {
  const until = validUntil ?? new Date(Date.now() + days * 86_400_000).toISOString();
  return { id: 'obj1', title: 'Загранпаспорт', validUntil: until } as unknown as LifeObject;
}

describe('syncReminderNotifications — дедуп и пере-взвод по дедлайну', () => {
  beforeEach(() => {
    localStorage.clear();
    shown.length = 0;
    vi.stubGlobal('Notification', FakeNotification);
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('показывает сработавшие пороги один раз, повтор — тишина', async () => {
    localStorage.setItem('los-objects-cache', JSON.stringify([objDue(5)])); // 90/30/7 уже прошли
    const first = await syncReminderNotifications();
    expect(first).toBeGreaterThan(0);
    const second = await syncReminderNotifications();
    expect(second).toBe(0); // всё уже показано — дублей нет
  });

  it('перенос дедлайна пере-взводит уведомления (новый дедлайн — новые ключи)', async () => {
    const obj = objDue(5);
    localStorage.setItem('los-objects-cache', JSON.stringify([obj]));
    expect(await syncReminderNotifications()).toBeGreaterThan(0);
    expect(await syncReminderNotifications()).toBe(0);

    // Продлеваем срок: те же пороги для НОВОГО дедлайна срабатывают заново.
    const extended = { ...obj, validUntil: new Date(Date.now() + 6 * 86_400_000).toISOString() };
    localStorage.setItem('los-objects-cache', JSON.stringify([extended]));
    expect(await syncReminderNotifications()).toBeGreaterThan(0);
  });
});
