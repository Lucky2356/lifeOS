import { describe, it, expect, beforeEach } from 'vitest';
import { AttachmentService, type UploadedFile } from './attachment.service';
import { InMemoryAttachmentRepository } from './attachment.repository';
import { AttachmentStorage } from './attachment-storage';
import { LifeObjectService } from './life-object.service';
import { InMemoryLifeObjectRepository } from './in-memory-life-object.repository';

const userA = '00000000-0000-0000-0000-0000000000a1';
const userB = '00000000-0000-0000-0000-0000000000b2';

function fileOf(mime: string, bytes = 10): UploadedFile {
  return { originalname: 'scan.png', mimetype: mime, size: bytes, buffer: Buffer.alloc(bytes, 7) };
}

describe('AttachmentService', () => {
  let service: AttachmentService;
  let objects: LifeObjectService;
  let objectId: string;

  beforeEach(async () => {
    const objectsRepo = new InMemoryLifeObjectRepository();
    objects = new LifeObjectService(objectsRepo);
    // хранилище в памяти (не пишем на диск в тесте)
    const mem = new Map<string, Buffer>();
    const storage = {
      save: async (id: string, c: Buffer) => void mem.set(id, c),
      load: async (id: string) => mem.get(id) ?? Buffer.alloc(0),
      remove: async (id: string) => void mem.delete(id),
    } as unknown as AttachmentStorage;
    service = new AttachmentService(new InMemoryAttachmentRepository(), storage, objects);
    const obj = await objects.create({ type: 'document', title: 'Паспорт' }, userA);
    objectId = obj.id;
  });

  it('загружает файл к своему объекту и возвращает его в списке', async () => {
    const a = await service.upload(objectId, userA, fileOf('image/png'));
    expect(a.filename).toBe('scan.png');
    expect((await service.list(objectId, userA)).map((x) => x.id)).toContain(a.id);
  });

  it('отклоняет недопустимый тип файла', async () => {
    await expect(service.upload(objectId, userA, fileOf('text/plain'))).rejects.toThrow();
  });

  it('нельзя грузить к чужому объекту', async () => {
    await expect(service.upload(objectId, userB, fileOf('image/png'))).rejects.toThrow();
  });

  it('нельзя скачать/удалить чужое вложение', async () => {
    const a = await service.upload(objectId, userA, fileOf('image/png'));
    await expect(service.download(a.id, userB)).rejects.toThrow();
    await expect(service.remove(a.id, userB)).rejects.toThrow();
  });

  it('removeForObject каскадно стирает все вложения объекта (файл + запись)', async () => {
    const a1 = await service.upload(objectId, userA, fileOf('image/png'));
    const a2 = await service.upload(objectId, userA, fileOf('application/pdf'));
    await service.removeForObject(objectId);
    expect(await service.list(objectId, userA)).toHaveLength(0);
    await expect(service.download(a1.id, userA)).rejects.toThrow(); // записи нет
    await expect(service.download(a2.id, userA)).rejects.toThrow();
  });

  it('removeAllForOwner стирает вложения только этого владельца', async () => {
    const objB = await objects.create({ type: 'document', title: 'Чужой' }, userB);
    const mine = await service.upload(objectId, userA, fileOf('image/png'));
    const theirs = await service.upload(objB.id, userB, fileOf('image/png'));
    await service.removeAllForOwner(userA);
    await expect(service.download(mine.id, userA)).rejects.toThrow();
    expect((await service.list(objB.id, userB)).map((x) => x.id)).toContain(theirs.id);
  });
});
