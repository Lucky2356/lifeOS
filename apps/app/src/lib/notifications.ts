import { computeReminders, daysUntil, defaultReminderRules } from '@life-os/domain';
import { getSetting, setSetting } from './store/db';
import { ledgerStore } from './store/objects';
import { householdStore } from './store/household';
import {
  notificationPermission,
  requestNotificationPermission as requestPermission,
  rescheduleReminders,
  showNow,
  type ScheduledReminder,
} from './platform-notify';

/**
 * Напоминания о приближающихся сроках — единственный канал оповещения (ADR 0006): ни писем,
 * ни сервера нет. Правила считает домен (computeReminders), доставку берёт на себя платформа.
 *
 * Наступившие пороги показываются сразу и запоминаются, чтобы не повторяться; будущие
 * планируются системой (на Android приходят и при закрытом приложении).
 */

const SHOWN_KEY = 'notified-keys';
/** Ключей копится немного, но не бесконечно — храним хвост последних показов. */
const SHOWN_LIMIT = 500;

async function shownKeys(): Promise<string[]> {
  return (await getSetting<string[]>(SHOWN_KEY)) ?? [];
}

/** Бытовая задача не нуждается в предупреждении за 90 дней — напоминаем в сам день срока. */
const taskReminderRules = [{ offsetDays: 0 }];

function taskPhrase(days: number): string {
  return days < 0 ? `просрочена на ${-days} дн.` : days === 0 ? 'срок сегодня' : `срок через ${days} дн.`;
}

function phrase(days: number): string {
  return days < 0
    ? `просрочено на ${-days} дн.`
    : days === 0
      ? 'истекает сегодня'
      : `истекает через ${days} дн.`;
}

export { notificationsSupported, notificationPermission, supportsScheduling } from './platform-notify';

/** Запросить разрешение и сразу подтянуть напоминания, если его дали. */
export async function requestNotificationPermission() {
  const permission = await requestPermission();
  if (permission === 'granted') await syncReminderNotifications();
  return permission;
}

/**
 * Показать наступившие напоминания и перепланировать будущие.
 * Возвращает число показанных сейчас уведомлений.
 */
export async function syncReminderNotifications(now: Date = new Date()): Promise<number> {
  if ((await notificationPermission()) !== 'granted') return 0;

  const objects = await ledgerStore.list();
  const shown = new Set(await shownKeys());
  const fresh: string[] = [];
  const future: ScheduledReminder[] = [];

  for (const obj of objects) {
    if (!obj.validUntil) continue;
    for (const reminder of computeReminders(obj.validUntil, defaultReminderRules)) {
      // Дедлайн в ключе: при переносе срока пороги пере-взводятся, и напоминание придёт снова.
      const key = `${obj.id}:${reminder.offsetDays}:${obj.validUntil}`;
      const fireAt = new Date(reminder.fireAt);
      const title = `Life OS: ${obj.title}`;

      if (fireAt.getTime() > now.getTime()) {
        future.push({ key, at: fireAt, title, body: phrase(reminder.offsetDays) });
        continue;
      }
      if (shown.has(key)) continue;
      await showNow(title, phrase(daysUntil(obj.validUntil, now) ?? 0), key);
      fresh.push(key);
    }
  }

  // Домашние задачи со сроком — тот же механизм, но одно напоминание в день срока.
  const household = await householdStore.current();
  const tasks = household ? await householdStore.tasks(household.id) : [];
  for (const task of tasks) {
    if (task.status !== 'open' || !task.dueAt) continue;
    const [reminder] = computeReminders(task.dueAt, taskReminderRules);
    if (!reminder) continue;
    const key = `task:${task.id}:${task.dueAt}`;
    const fireAt = new Date(reminder.fireAt);
    const title = `Life OS: ${task.title}`;
    if (fireAt.getTime() > now.getTime()) {
      // К моменту срабатывания это будет ровно день срока.
      future.push({ key, at: fireAt, title, body: 'задача по дому · срок сегодня' });
      continue;
    }
    if (shown.has(key)) continue;
    await showNow(title, `задача по дому · ${taskPhrase(daysUntil(task.dueAt, now) ?? 0)}`, key);
    fresh.push(key);
  }

  if (fresh.length > 0) {
    await setSetting(SHOWN_KEY, [...shown, ...fresh].slice(-SHOWN_LIMIT));
  }
  try {
    await rescheduleReminders(future);
  } catch {
    // Планировщик мог отказать (нет прав на будильник) — показанное уже показано, а
    // приложение всё равно проверит сроки при следующем открытии.
  }
  return fresh.length;
}

let watcherStarted = false;

/**
 * Запустить наблюдатель: на старте, при возврате к приложению и раз в 6 часов.
 * На Android этого хватает, потому что будущие напоминания планирует система; на десктопе
 * приложение должно быть запущено — планировщика при закрытом окне там нет.
 */
export async function startReminderWatcher(): Promise<void> {
  if (typeof window === 'undefined' || watcherStarted) return;
  watcherStarted = true;
  const tick = () => void syncReminderNotifications().catch(() => {});
  await syncReminderNotifications().catch(() => {});
  window.addEventListener('focus', tick);
  setInterval(tick, 6 * 3_600_000);
}
