import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Attachment,
  Decision,
  Household,
  HouseholdTask,
  LifeObject,
  Membership,
  PlaybookProgress,
} from '@life-os/domain';

/**
 * Единственное хранилище Life OS — IndexedDB на устройстве (ADR 0006). Сервера нет: то, что лежит
 * здесь, и есть все данные пользователя. localStorage не подошёл — лимит ~5 МБ и только строки,
 * а вложения нужно хранить как Blob.
 *
 * Хранилище привязано к origin оболочки: `https://localhost` в Capacitor (androidScheme) и каталог
 * WebView2 по `identifier` в Tauri. Менять appId/androidScheme/identifier нельзя — данные станут
 * недоступны.
 */

const DB_NAME = 'life-os';
const DB_VERSION = 1;

export interface LifeOsSchema extends DBSchema {
  objects: { key: string; value: LifeObject };
  decisions: { key: string; value: Decision };
  households: { key: string; value: Household };
  members: { key: string; value: Membership; indexes: { 'by-household': string } };
  tasks: { key: string; value: HouseholdTask; indexes: { 'by-household': string } };
  progress: { key: string; value: PlaybookProgress };
  attachments: { key: string; value: Attachment; indexes: { 'by-object': string } };
  /**
   * Содержимое файлов: ключ — id вложения, значение — байты. Именно ArrayBuffer, а не Blob:
   * структурное клонирование ArrayBuffer работает одинаково во всех WebView, тип файла и так
   * лежит в метаданных, а Blob для просмотра собирается на месте.
   */
  files: { key: string; value: ArrayBuffer };
  /** Настройки и служебные флаги: ключ — строка, значение — любое сериализуемое. */
  settings: { key: string; value: unknown };
}

/** Имена хранилищ перечислены явно: DBSchema объявляет строковый индекс, и keyof даёт просто string. */
export type StoreName =
  | 'objects'
  | 'decisions'
  | 'households'
  | 'members'
  | 'tasks'
  | 'progress'
  | 'attachments'
  | 'files'
  | 'settings';

/** Хранилища с пользовательскими данными — источник правды для экспорта и полной очистки. */
export const dataStores = [
  'objects',
  'decisions',
  'households',
  'members',
  'tasks',
  'progress',
  'attachments',
  'files',
] as const satisfies readonly StoreName[];

let dbPromise: Promise<IDBPDatabase<LifeOsSchema>> | null = null;

export function db(): Promise<IDBPDatabase<LifeOsSchema>> {
  dbPromise ??= openDB<LifeOsSchema>(DB_NAME, DB_VERSION, {
    // Версия 1 — база создаётся с нуля. Следующие версии дописывают свои изменения здесь же,
    // поэтому каждое хранилище создаётся только при его отсутствии.
    upgrade(database) {
      const missing = (name: StoreName) => !database.objectStoreNames.contains(name);

      if (missing('objects')) database.createObjectStore('objects', { keyPath: 'id' });
      if (missing('decisions')) database.createObjectStore('decisions', { keyPath: 'id' });
      if (missing('households')) database.createObjectStore('households', { keyPath: 'id' });
      if (missing('progress')) database.createObjectStore('progress', { keyPath: 'id' });
      if (missing('files')) database.createObjectStore('files');
      if (missing('settings')) database.createObjectStore('settings');

      if (missing('members')) {
        database.createObjectStore('members', { keyPath: 'id' }).createIndex('by-household', 'householdId');
      }
      if (missing('tasks')) {
        database.createObjectStore('tasks', { keyPath: 'id' }).createIndex('by-household', 'householdId');
      }
      if (missing('attachments')) {
        database.createObjectStore('attachments', { keyPath: 'id' }).createIndex('by-object', 'objectId');
      }
    },
  });
  return dbPromise;
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('settings', key)) as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key);
}

/** Удалить все пользовательские данные, сохранив настройки (тему, id владельца). */
export async function clearAllData(): Promise<void> {
  const database = await db();
  const tx = database.transaction(dataStores, 'readwrite');
  await Promise.all([...dataStores.map((name) => tx.objectStore(name).clear()), tx.done]);
}

/** Закрыть соединение и сбросить кэш. Нужно тестам: иначе deleteDB зависает на открытом хэндле. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const database = await dbPromise;
  dbPromise = null;
  database.close();
}
