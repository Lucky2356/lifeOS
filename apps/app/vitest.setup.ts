import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { closeDb } from './src/lib/store/db';
import { resetOwnerCache } from './src/lib/store/local-user';

/**
 * Тесты работают с настоящим API IndexedDB (fake-indexeddb), а не с моками хранилища:
 * иначе проверялись бы заглушки, а не поведение приложения. База пересоздаётся между тестами.
 */
afterEach(async () => {
  cleanup();
  await closeDb();
  resetOwnerCache();
  await deleteDB('life-os');
});
