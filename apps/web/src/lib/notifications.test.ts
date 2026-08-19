import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncReminderNotifications } from './notifications';
import { ledgerStore } from './store/objects';

const shown: string[] = [];

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = async (): Promise<NotificationPermission> => 'granted';
  constructor(title: string) {
    shown.push(title);
  }
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('syncReminderNotifications', () => {
  beforeEach(() => {
    shown.length = 0;
    vi.stubGlobal('Notification', FakeNotification);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('показывает сработавшие пороги один раз, повтор — тишина', async () => {
    // Дедлайн через 5 дней: пороги 90/30/7 уже наступили.
    await ledgerStore.create({ type: 'document', title: 'Загранпаспорт', validUntil: inDays(5) });

    expect(await syncReminderNotifications()).toBeGreaterThan(0);
    expect(shown.every((t) => t.includes('Загранпаспорт'))).toBe(true);
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('перенос дедлайна пере-взводит напоминания', async () => {
    const obj = await ledgerStore.create({
      type: 'document',
      title: 'Полис',
      validUntil: inDays(5),
    });
    expect(await syncReminderNotifications()).toBeGreaterThan(0);
    expect(await syncReminderNotifications()).toBe(0);

    await ledgerStore.update(obj.id, { validUntil: inDays(6) });
    expect(await syncReminderNotifications()).toBeGreaterThan(0);
  });

  it('до наступления порога молчит', async () => {
    // Дедлайн через год — ни один порог ещё не наступил.
    await ledgerStore.create({ type: 'document', title: 'Гарантия', validUntil: inDays(400) });
    expect(await syncReminderNotifications()).toBe(0);
    expect(shown).toEqual([]);
  });

  it('объекты без срока игнорируются', async () => {
    await ledgerStore.create({ type: 'document', title: 'Без срока' });
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('без разрешения ничего не показывает', async () => {
    FakeNotification.permission = 'default';
    await ledgerStore.create({ type: 'document', title: 'Паспорт', validUntil: inDays(5) });
    expect(await syncReminderNotifications()).toBe(0);
    expect(shown).toEqual([]);
    FakeNotification.permission = 'granted';
  });
});
