import {
  applyLifeObjectUpdate,
  createLifeObject,
  type CreateLifeObjectInput,
  type LifeObject,
  type UpdateLifeObjectInput,
} from '@life-os/domain';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Life Ledger на устройстве. Правила — доменные (createLifeObject/applyLifeObjectUpdate),
 * хранение — IndexedDB. Сети нет: то, что здесь, и есть все объекты пользователя.
 */

export const ledgerStore = {
  /** Все объекты, новые сверху. */
  async list(): Promise<LifeObject[]> {
    const all = await (await db()).getAll('objects');
    return all.filter((o) => o.deletedAt === null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<LifeObject | null> {
    const obj = await (await db()).get('objects', id);
    return obj && obj.deletedAt === null ? obj : null;
  },

  async create(input: CreateLifeObjectInput): Promise<LifeObject> {
    const obj = createLifeObject(input, await ownerUserId());
    await (await db()).put('objects', obj);
    return obj;
  },

  async update(id: string, patch: UpdateLifeObjectInput): Promise<LifeObject> {
    const database = await db();
    const current = await database.get('objects', id);
    if (!current) throw new Error('Объект не найден');
    const updated = applyLifeObjectUpdate(current, patch);
    await database.put('objects', updated);
    return updated;
  },

  /** Удалить объект вместе с его вложениями и их содержимым (каскад). */
  async remove(id: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['objects', 'attachments', 'files'], 'readwrite');
    const attachmentIds = await tx.objectStore('attachments').index('by-object').getAllKeys(id);
    await Promise.all([
      tx.objectStore('objects').delete(id),
      ...attachmentIds.map((aid) => tx.objectStore('attachments').delete(aid)),
      ...attachmentIds.map((aid) => tx.objectStore('files').delete(aid)),
      tx.done,
    ]);
  },
};
