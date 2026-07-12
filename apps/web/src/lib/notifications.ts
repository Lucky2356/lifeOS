import { computeReminders, daysUntil, defaultReminderRules, type LifeObject } from '@life-os/domain';

/**
 * Клиентские уведомления о приближающихся сроках (Notification API). Работают для установленного PWA
 * и в локальном режиме — там сервера/email нет, и это единственный канал напоминаний. Считаем по тем
 * же доменным правилам (computeReminders), что и сервер; дедуп показов — в localStorage.
 */

const CACHE = 'los-objects-cache';
const SHOWN = 'los-notified';

function readObjects(): LifeObject[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? '[]') as LifeObject[];
  } catch {
    return [];
  }
}
function shownKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function markShown(keys: string[]) {
  const s = shownKeys();
  keys.forEach((k) => s.add(k));
  localStorage.setItem(SHOWN, JSON.stringify([...s]));
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}
export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied';
}
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  const p = await Notification.requestPermission();
  if (p === 'granted') void syncReminderNotifications();
  return p;
}

async function show(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body });
      return;
    }
  } catch {
    /* fallback ниже */
  }
  new Notification(title, { body });
}

function phrase(d: number): string {
  return d < 0 ? `просрочено на ${-d} дн.` : d === 0 ? 'истекает сегодня' : `истекает через ${d} дн.`;
}

/** Показать уведомления по сработавшим и ещё не показанным порогам. Возвращает число показанных. */
export async function syncReminderNotifications(now: Date = new Date()): Promise<number> {
  if (notificationPermission() !== 'granted') return 0;
  const shown = shownKeys();
  const newKeys: string[] = [];
  for (const o of readObjects()) {
    if (!o.validUntil) continue;
    for (const r of computeReminders(o.validUntil, defaultReminderRules)) {
      if (new Date(r.fireAt).getTime() > now.getTime()) continue;
      const key = `${o.id}:${r.offsetDays}`;
      if (shown.has(key)) continue;
      void show(`Life OS: ${o.title}`, phrase(daysUntil(o.validUntil, now) ?? 0));
      newKeys.push(key);
    }
  }
  if (newKeys.length) markShown(newKeys);
  return newKeys.length;
}

let watcherStarted = false;
/** Запустить наблюдатель: на старте, при фокусе окна и периодически (пока приложение открыто). */
export function startReminderWatcher(): void {
  if (typeof window === 'undefined' || watcherStarted) return; // защита от повторной подписки/таймеров
  watcherStarted = true;
  void syncReminderNotifications();
  window.addEventListener('focus', () => void syncReminderNotifications());
  setInterval(() => void syncReminderNotifications(), 6 * 3_600_000);
}
