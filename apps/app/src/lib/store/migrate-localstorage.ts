import {
  decisionSchema,
  householdSchema,
  householdTaskSchema,
  lifeObjectSchema,
  membershipSchema,
  playbookProgressSchema,
} from '@life-os/domain';
import type { z } from 'zod';
import { db, getSetting, setSetting } from './db';

/**
 * Разовый перенос данных прежнего локального режима из localStorage в IndexedDB.
 * До версии 1.0 клиент держал кэши строками в localStorage; кто уже пользовался приложением без
 * аккаунта — не должен потерять записи при переходе на локальную архитектуру (ADR 0006).
 * Битые записи пропускаются молча: потерять одну лучше, чем не перенести ничего.
 */

const DONE_FLAG = 'migrated-localstorage';
const LEGACY_PREFIX = 'los-';
/** Тему прежний код тоже держит в localStorage, и она там и остаётся. */
const KEEP = new Set(['los-theme']);

function readLegacy<S extends z.ZodTypeAny>(key: string, schema: S): z.infer<S>[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const res = schema.safeParse(item);
      return res.success ? [res.data] : [];
    });
  } catch {
    return [];
  }
}

export async function migrateLegacyLocalStorage(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  if (await getSetting<boolean>(DONE_FLAG)) return;

  const objects = readLegacy('los-objects-cache', lifeObjectSchema);
  const decisions = readLegacy('los-decisions-cache', decisionSchema);
  const households = readLegacy('los-households-cache', householdSchema);
  const progress = readLegacy('los-progress-cache', playbookProgressSchema);

  // Участники и задачи лежали в ключах, привязанных к id дома.
  const members = [];
  const tasks = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('los-members-')) members.push(...readLegacy(key, membershipSchema));
    if (key.startsWith('los-htasks-')) tasks.push(...readLegacy(key, householdTaskSchema));
  }

  const database = await db();
  const tx = database.transaction(
    ['objects', 'decisions', 'households', 'members', 'tasks', 'progress'],
    'readwrite',
  );
  await Promise.all([
    ...objects.map((o) => tx.objectStore('objects').put(o)),
    ...decisions.map((d) => tx.objectStore('decisions').put(d)),
    ...households.map((h) => tx.objectStore('households').put(h)),
    ...members.map((m) => tx.objectStore('members').put(m)),
    ...tasks.map((t) => tx.objectStore('tasks').put(t)),
    ...progress.map((p) => tx.objectStore('progress').put(p)),
    tx.done,
  ]);

  await setSetting(DONE_FLAG, true);

  // Прежние ключи больше не источник правды — убираем, чтобы не путать при отладке.
  const stale = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
    (k): k is string => Boolean(k) && k!.startsWith(LEGACY_PREFIX) && !KEEP.has(k!),
  );
  stale.forEach((k) => localStorage.removeItem(k));
}
