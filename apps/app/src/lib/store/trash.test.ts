import { describe, expect, it } from 'vitest';
import { trashRetentionDays } from '@life-os/domain';
import { ledgerStore } from './objects';
import { attachmentsStore } from './attachments';
import { db } from './db';

/** Настоящий PNG — вложения проверяются по магическим байтам, а не по имени файла. */
function pngFile(name = 'scan.png'): File {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type: 'image/png' });
}

/** Состарить удаление: переписываем дату напрямую, чтобы не ждать 30 дней в тесте. */
async function backdateDeletion(id: string, deletedAt: string): Promise<void> {
  const database = await db();
  const obj = await database.get('objects', id);
  await database.put('objects', { ...obj!, deletedAt });
}

describe('корзина реестра', () => {
  it('удалённый объект уходит из списка, но остаётся в корзине', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    await ledgerStore.remove(created.id);

    expect(await ledgerStore.list()).toEqual([]);
    expect(await ledgerStore.get(created.id)).toBeNull();
    expect((await ledgerStore.deleted()).map((o) => o.title)).toEqual(['Паспорт']);
  });

  it('вложения переживают удаление и возвращаются вместе с объектом', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    const attachment = await attachmentsStore.add(created.id, pngFile());

    await ledgerStore.remove(created.id);
    // Главное обещание корзины: документ возвращается со сканом, а не пустой оболочкой.
    expect((await attachmentsStore.list(created.id)).map((a) => a.id)).toEqual([attachment.id]);

    await ledgerStore.restore(created.id);
    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Паспорт']);
    expect((await attachmentsStore.read(attachment.id)).meta.filename).toBe('scan.png');
  });

  it('окончательное удаление уносит вложения и их содержимое', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    const attachment = await attachmentsStore.add(created.id, pngFile());

    await ledgerStore.remove(created.id);
    await ledgerStore.purge(created.id);

    expect(await ledgerStore.deleted()).toEqual([]);
    expect(await attachmentsStore.list(created.id)).toEqual([]);
    expect(await (await db()).get('files', attachment.id)).toBeUndefined();
  });

  it('корзина вычищается сама, когда срок вышел', async () => {
    const old = await ledgerStore.create({ type: 'document', title: 'Старое' });
    const fresh = await ledgerStore.create({ type: 'document', title: 'Свежее' });
    await ledgerStore.remove(old.id);
    await ledgerStore.remove(fresh.id);

    const longAgo = new Date(Date.now() - (trashRetentionDays + 1) * 86_400_000).toISOString();
    await backdateDeletion(old.id, longAgo);

    expect(await ledgerStore.purgeExpired()).toBe(1);
    expect((await ledgerStore.deleted()).map((o) => o.title)).toEqual(['Свежее']);
  });

  it('живой объект чистка не трогает', async () => {
    await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    expect(await ledgerStore.purgeExpired()).toBe(0);
    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Паспорт']);
  });
});
