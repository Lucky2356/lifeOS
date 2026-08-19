import { newId } from '@life-os/domain';
import { getSetting, setSetting } from './db';

/**
 * Стабильный идентификатор владельца данных на этом устройстве. Аккаунтов нет (ADR 0006), но
 * доменные схемы требуют ownerUserId — он создаётся при первом запуске и больше не меняется.
 */

const KEY = 'owner-user-id';
const LEGACY_KEY = 'los-user';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cached: string | null = null;

export async function ownerUserId(): Promise<string> {
  if (cached) return cached;
  const stored = await getSetting<string>(KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  // Кто уже пользовался локальным режимом — сохраняет свой прежний id, чтобы данные не «осиротели».
  const legacy = typeof localStorage === 'undefined' ? null : localStorage.getItem(LEGACY_KEY);
  const id = legacy && UUID.test(legacy) ? legacy : newId();
  await setSetting(KEY, id);
  cached = id;
  return id;
}

/** Сбросить кэш (тесты, полное удаление данных). */
export function resetOwnerCache(): void {
  cached = null;
}
