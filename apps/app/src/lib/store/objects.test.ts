import { describe, it, expect } from 'vitest';
import { ledgerStore } from './objects';
import { attachmentsStore } from './attachments';
import { db } from './db';

/** Настоящий PNG — валидация вложений смотрит на магические байты, а не на имя файла. */
function pngFile(name = 'scan.png'): File {
  const bytes = new Uint8Array(new ArrayBuffer(32));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type: 'image/png' });
}

describe('ledgerStore', () => {
  it('создаёт объект и находит его по id', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
    expect(await ledgerStore.get(created.id)).toEqual(created);
  });

  it('отдаёт список новыми сверху', async () => {
    await ledgerStore.create({ type: 'document', title: 'Первый' });
    await new Promise((r) => setTimeout(r, 2));
    await ledgerStore.create({ type: 'insurance', title: 'Второй' });
    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Второй', 'Первый']);
  });

  it('правка бампит version и сохраняется', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    const updated = await ledgerStore.update(created.id, { title: 'Паспорт РФ' });
    expect(updated.version).toBe(created.version + 1);
    expect((await ledgerStore.get(created.id))?.title).toBe('Паспорт РФ');
  });

  it('правка несуществующего объекта — ошибка', async () => {
    await expect(
      ledgerStore.update('00000000-0000-0000-0000-0000000000ff', { title: 'нет' }),
    ).rejects.toThrow();
  });

  it('хранит поля документа, чувствительность и «действует с»', async () => {
    const created = await ledgerStore.create({
      type: 'document',
      title: 'Загранпаспорт',
      sensitivity: 'sensitive',
      validFrom: '2026-01-15T00:00:00.000Z',
      data: { number: '75 1234567', issuedBy: 'МВД России' },
    });

    const stored = await ledgerStore.get(created.id);
    expect(stored?.data).toEqual({ number: '75 1234567', issuedBy: 'МВД России' });
    expect(stored?.sensitivity).toBe('sensitive');
    expect(stored?.validFrom).toBe('2026-01-15T00:00:00.000Z');
  });

  it('правка полей заменяет их целиком — опустошённое поле исчезает', async () => {
    const created = await ledgerStore.create({
      type: 'vehicle',
      title: 'Машина',
      data: { plate: 'А123ВС', vin: 'XTA210990' },
    });

    await ledgerStore.update(created.id, { data: { plate: 'А123ВС' }, sensitivity: 'high' });

    const stored = await ledgerStore.get(created.id);
    expect(stored?.data).toEqual({ plate: 'А123ВС' });
    expect(stored?.sensitivity).toBe('high');
  });

  it('окончательное удаление уносит вложения объекта и не задевает чужие', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Договор' });
    const other = await ledgerStore.create({ type: 'document', title: 'Другой' });
    const attachment = await attachmentsStore.add(obj.id, pngFile());
    const keep = await attachmentsStore.add(other.id, pngFile('keep.png'));

    // remove() кладёт в корзину и вложения бережёт — уносит их только purge().
    await ledgerStore.purge(obj.id);

    expect(await ledgerStore.get(obj.id)).toBeNull();
    expect(await attachmentsStore.list(obj.id)).toEqual([]);
    const database = await db();
    expect(await database.get('files', attachment.id)).toBeUndefined();
    // Вложения других объектов не задеты.
    expect(await database.get('files', keep.id)).toBeDefined();
  });
});

describe('архив', () => {
  it('объект переводится в архив и обратно', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Старый паспорт' });
    expect(obj.status).toBe('active');

    const archived = await ledgerStore.update(obj.id, { status: 'archived' });
    expect(archived.status).toBe('archived');

    // Хранилище отдаёт всё: разделение на активные и архив — дело экрана.
    expect((await ledgerStore.list()).map((o) => o.status)).toEqual(['archived']);

    expect((await ledgerStore.update(obj.id, { status: 'active' })).status).toBe('active');
  });
});
