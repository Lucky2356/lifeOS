import { describe, it, expect } from 'vitest';
import { maxAttachmentBytes } from '@life-os/domain';
import { AttachmentFailure, attachmentsStore } from './attachments';
import { ledgerStore } from './objects';

function fileWithMagic(magic: number[], name: string, type: string, size = 64): File {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  bytes.set(magic);
  return new File([bytes], name, { type });
}

const png = (name = 'scan.png') =>
  fileWithMagic([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name, 'image/png');
const pdf = (name = 'doc.pdf') => fileWithMagic([0x25, 0x50, 0x44, 0x46], name, 'application/pdf');

describe('attachmentsStore', () => {
  it('принимает PNG и PDF и наследует чувствительность объекта', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Паспорт', sensitivity: 'high' });
    const a = await attachmentsStore.add(obj.id, png());
    const b = await attachmentsStore.add(obj.id, pdf());

    expect(a.mime).toBe('image/png');
    expect(b.mime).toBe('application/pdf');
    expect(a.sensitivity).toBe('high');
    expect((await attachmentsStore.list(obj.id)).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('определяет тип по содержимому, а не по расширению и MIME системы', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Договор' });
    // Файл называется картинкой и заявляет image/png, но внутри — PDF.
    const disguised = fileWithMagic([0x25, 0x50, 0x44, 0x46], 'photo.png', 'image/png');
    expect((await attachmentsStore.add(obj.id, disguised)).mime).toBe('application/pdf');
  });

  it('отказывает файлу неподдерживаемого типа', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Заметка' });
    const txt = new File([new Uint8Array(new ArrayBuffer(32))], 'note.txt', { type: 'text/plain' });
    await expect(attachmentsStore.add(obj.id, txt)).rejects.toThrow(AttachmentFailure);
    await expect(attachmentsStore.add(obj.id, txt)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('отказывает слишком большому файлу', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Скан' });
    const big = png('big.png');
    // Размер подменяем, чтобы не выделять 25 МБ в тесте.
    Object.defineProperty(big, 'size', { value: maxAttachmentBytes + 1 });
    await expect(attachmentsStore.add(obj.id, big)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('не привязывает файл к несуществующему объекту', async () => {
    await expect(attachmentsStore.add('00000000-0000-0000-0000-0000000000ff', png())).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('удаление убирает и метаданные, и файл', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Полис' });
    const a = await attachmentsStore.add(obj.id, pdf());
    await attachmentsStore.remove(a.id);
    expect(await attachmentsStore.list(obj.id)).toEqual([]);
    await expect(attachmentsStore.read(a.id)).rejects.toMatchObject({ code: 'not-found' });
  });
});
