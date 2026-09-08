import { describe, expect, it } from 'vitest';
import { closeDb, db, DB_VERSION, schemaSteps, type StoreName } from './db';
import { ledgerStore } from './objects';

/**
 * Единственный тест, который смотрит на саму схему, а не на данные поверх неё.
 *
 * Пока шаг обновления один, апгрейда с версии на версию не существует и проверять его нечем.
 * Зато здесь зафиксирована форма схемы: миграция, забывшая создать хранилище или индекс, уронит
 * этот тест, а не данные пользователя. Хранилища без keyPath (`files`, `settings`) держат ключ
 * снаружи записи — это не оплошность, а способ класть туда ArrayBuffer и произвольные значения.
 */
const expected: [StoreName, string | null, string[]][] = [
  ['objects', 'id', []],
  ['decisions', 'id', []],
  ['households', 'id', []],
  ['members', 'id', ['by-household']],
  ['tasks', 'id', ['by-household']],
  ['progress', 'id', []],
  ['attachments', 'id', ['by-object']],
  ['files', null, []],
  ['settings', null, []],
];

describe('схема IndexedDB', () => {
  it('версия базы равна числу шагов обновления', () => {
    expect(DB_VERSION).toBe(schemaSteps.length);
  });

  it('свежая база содержит все хранилища с нужными ключами и индексами', async () => {
    const database = await db();

    expect([...database.objectStoreNames].sort()).toEqual(expected.map(([name]) => name).sort());

    for (const [name, keyPath, indexes] of expected) {
      const store = database.transaction(name).store;
      expect(store.keyPath).toEqual(keyPath);
      expect([...store.indexNames].sort()).toEqual(indexes);
    }
  });

  it('записи переживают закрытие и повторное открытие соединения', async () => {
    await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
    await closeDb();

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Загранпаспорт']);
  });
});
