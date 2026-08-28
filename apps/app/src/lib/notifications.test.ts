import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncReminderNotifications } from './notifications';
import { ledgerStore } from './store/objects';
import { decisionsStore } from './store/decisions';
import { householdStore } from './store/household';

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

describe('напоминания о домашних задачах', () => {
  beforeEach(() => {
    shown.length = 0;
    vi.stubGlobal('Notification', FakeNotification);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function houseWithTask(dueAt: string | null) {
    const house = await householdStore.create('Наш дом', 'Алекс');
    return householdStore.createTask(house.id, { title: 'Сдать показания счётчика', dueAt });
  }

  it('напоминает в день срока и только один раз', async () => {
    await houseWithTask(inDays(0));
    expect(await syncReminderNotifications()).toBe(1);
    expect(shown.some((t) => t.includes('Сдать показания счётчика'))).toBe(true);
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('о просроченной задаче напоминает', async () => {
    await houseWithTask(inDays(-3));
    expect(await syncReminderNotifications()).toBe(1);
  });

  it('заранее не беспокоит', async () => {
    await houseWithTask(inDays(5));
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('задача без срока и выполненная задача не напоминают', async () => {
    await houseWithTask(null);
    const done = await houseWithTask(inDays(0));
    await householdStore.toggleTask(done.id);
    expect(await syncReminderNotifications()).toBe(0);
  });
});

describe('напоминание вернуться к решению', () => {
  beforeEach(() => {
    shown.length = 0;
    vi.stubGlobal('Notification', FakeNotification);
  });
  afterEach(() => vi.unstubAllGlobals());

  const decided = async (reviewAt: string | null) => {
    const d = await decisionsStore.create({ title: 'Менять ли работу' });
    return decisionsStore.update(d.id, {
      status: 'decided',
      chosenOptionId: null,
      decidedAt: new Date().toISOString(),
      reviewAt,
    });
  };

  it('зовёт обратно, когда назначенный срок наступил', async () => {
    await decided(inDays(-1));
    expect(await syncReminderNotifications()).toBe(1);
    expect(shown[0]).toContain('Менять ли работу');
    // Повторно не зовём: одно напоминание на одну дату.
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('молчит, пока срок не наступил', async () => {
    await decided(inDays(30));
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('решение без назначенной даты не напоминает о себе', async () => {
    await decided(null);
    expect(await syncReminderNotifications()).toBe(0);
  });

  it('записанный исход снимает напоминание — возвращаться уже незачем', async () => {
    const d = await decided(inDays(-1));
    await decisionsStore.update(d.id, { actualOutcome: 'вышло лучше ожидаемого' });
    expect(await syncReminderNotifications()).toBe(0);
  });
});
