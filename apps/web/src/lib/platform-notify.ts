/**
 * Уведомления в трёх средах. Разница принципиальная: на Android напоминания планируются
 * системой и приходят при закрытом приложении, а в вебе и на десктопе показать уведомление
 * можно только пока приложение запущено — планировщика там нет.
 */

export type NotifyPermission = 'granted' | 'denied' | 'default';

/** Одно запланированное напоминание. `key` — стабильный ключ порога, из него берётся id. */
export interface ScheduledReminder {
  key: string;
  at: Date;
  title: string;
  body: string;
}

/** Android планирует не всё подряд: держим только ближайшие напоминания. */
export const maxScheduled = 64;

function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  );
}

const webNotifications = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

/** Умеет ли среда доставлять напоминания при закрытом приложении. */
export function supportsScheduling(): boolean {
  return isCapacitor();
}

export function notificationsSupported(): boolean {
  return isCapacitor() || webNotifications();
}

export async function notificationPermission(): Promise<NotifyPermission> {
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.checkPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }
  if (!webNotifications()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default';
  }
  if (!webNotifications()) return 'denied';
  return Notification.requestPermission();
}

/** Идентификатор уведомления для Android — 32-битный int, поэтому ключ сворачивается в число. */
export function notificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  return hash === 0 ? 1 : hash;
}

/** Показать уведомление сейчас (порог уже наступил). */
export async function showNow(title: string, body: string, key: string): Promise<void> {
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{ id: notificationId(key), title, body }],
    });
    return;
  }
  if (webNotifications() && Notification.permission === 'granted') new Notification(title, { body });
}

/**
 * Перепланировать будущие напоминания. Прежний план снимается целиком: сроки могли измениться,
 * а объекты — исчезнуть, и оставлять старые уведомления нельзя.
 *
 * Android может пересоздавать план после перезагрузки устройства не полностью, поэтому
 * планирование повторяется при каждом запуске приложения.
 */
export async function rescheduleReminders(items: ScheduledReminder[]): Promise<void> {
  if (!isCapacitor()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const soonest = [...items].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, maxScheduled);
  if (soonest.length === 0) return;

  await LocalNotifications.schedule({
    notifications: soonest.map((r) => ({
      id: notificationId(r.key),
      title: r.title,
      body: r.body,
      schedule: { at: r.at, allowWhileIdle: true },
    })),
  });
}
