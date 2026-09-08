import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
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

/** Транзакция обновления схемы: в ней доступны все хранилища базы. */
type UpgradeTx = IDBPTransaction<LifeOsSchema, StoreNames<LifeOsSchema>[], 'versionchange'>;

export type SchemaStep = (database: IDBPDatabase<LifeOsSchema>, tx: UpgradeTx) => void;

/**
 * Шаги обновления схемы: индекс + 1 — версия, до которой шаг поднимает базу. `schemaSteps[0]`
 * создаёт версию 1, следующий поднимет с 1 до 2, и так далее. Уже применённые не повторяются:
 * `upgrade` получает `oldVersion`, и цикл начинается с него.
 *
 * Шагу передаётся и база, и транзакция версии. Второе принципиально: без транзакции нельзя ни
 * добавить индекс к существующему хранилищу, ни переписать уже лежащие записи. Прежний `upgrade`
 * принимал одну только базу и умел лишь создавать недостающие хранилища — то есть на живой базе
 * не сделал бы ни того, ни другого, хотя код и документация обещали, что следующая версия просто
 * допишет своё.
 */
export const schemaSteps: SchemaStep[] = [
  /** → версия 1: база создаётся с нуля, поэтому проверять существующее незачем. */
  function createStores(database) {
    database.createObjectStore('objects', { keyPath: 'id' });
    database.createObjectStore('decisions', { keyPath: 'id' });
    database.createObjectStore('households', { keyPath: 'id' });
    database.createObjectStore('progress', { keyPath: 'id' });
    database.createObjectStore('files');
    database.createObjectStore('settings');

    database.createObjectStore('members', { keyPath: 'id' }).createIndex('by-household', 'householdId');
    database.createObjectStore('tasks', { keyPath: 'id' }).createIndex('by-household', 'householdId');
    database.createObjectStore('attachments', { keyPath: 'id' }).createIndex('by-object', 'objectId');
  },
];

/** Версия базы — это число шагов. Добавили шаг — версия выросла сама, забыть её нельзя. */
export const DB_VERSION = schemaSteps.length;

let dbPromise: Promise<IDBPDatabase<LifeOsSchema>> | null = null;

export function db(): Promise<IDBPDatabase<LifeOsSchema>> {
  dbPromise ??= openDB<LifeOsSchema>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, tx) {
      for (const step of schemaSteps.slice(oldVersion)) step(database, tx);
    },
    /**
     * Другая вкладка держит базу открытой на прежней версии и не даёт обновить схему. Без этого
     * обработчика `openDB` просто не разрешается — молча и навсегда.
     */
    blocked() {
      // Диагностика для разработчика в консоли, не текст интерфейса.
      console.warn('Life OS: storage upgrade is waiting for other tabs of the app to close.');
    },
    /** Обратная сторона: это нас просят закрыться ради обновления. Держать чужое обновление нельзя. */
    blocking() {
      void closeDb();
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

/**
 * Ключи `settings`, которые полное удаление данных обязано снести вместе с самими данными.
 *
 * Снимок отката — это копия всех записей и вложений целиком (см. `stashRollback` в `backup.ts`).
 * Он намеренно лежит в `settings`, чтобы пережить импорт; но пережить «удалить все данные» он не
 * должен: тогда приложение обещает удаление и его не делает, а копия документов и сканов остаётся
 * на устройстве ещё на неделю. Показанные напоминания — тоже след пользователя, и без данных они
 * ссылаются в пустоту.
 *
 * Остальные настройки очистку переживают намеренно: id владельца и отметка о переносе описывают
 * не данные, а саму установку приложения.
 */
export const wipedSettings = ['pre-import-rollback', 'notified-keys'] as const;

/** Удалить все пользовательские данные, сохранив настройки установки (id владельца, флаг переноса). */
export async function clearAllData(): Promise<void> {
  const database = await db();
  const tx = database.transaction([...dataStores, 'settings'], 'readwrite');
  await Promise.all([
    ...dataStores.map((name) => tx.objectStore(name).clear()),
    ...wipedSettings.map((key) => tx.objectStore('settings').delete(key)),
    tx.done,
  ]);
}

export interface StorageUsage {
  /** Сколько занято приложением, в байтах. */
  usage: number;
  /** Сколько всего доступно, в байтах. */
  quota: number;
  /** Защищено ли хранилище от вытеснения системой. */
  persistent: boolean;
}

/**
 * Попросить систему не вытеснять данные. Для локального приложения это единственная копия, и
 * best-effort хранилище браузер вправе очистить под нехватку места. В упакованных оболочках данные
 * и так лежат в каталоге приложения, поэтому это дешёвая страховка, а не спасение от беды.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Сколько места занято и сколько доступно. null — платформа не сообщает. */
export async function storageUsage(): Promise<StorageUsage | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persistent = (await navigator.storage.persisted?.()) ?? false;
    return { usage, quota, persistent };
  } catch {
    return null;
  }
}

/** Закрыть соединение и сбросить кэш. Нужно тестам: иначе deleteDB зависает на открытом хэндле. */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const database = await dbPromise;
  dbPromise = null;
  database.close();
}
