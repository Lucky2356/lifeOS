import { describe, it, expect, beforeEach } from 'vitest';
import { LifeObjectService } from './life-object.service';
import { InMemoryLifeObjectRepository } from './in-memory-life-object.repository';

const userA = '00000000-0000-0000-0000-00000000000a';
const userB = '00000000-0000-0000-0000-00000000000b';

describe('LifeObjectService', () => {
  let service: LifeObjectService;

  beforeEach(() => {
    service = new LifeObjectService(new InMemoryLifeObjectRepository());
  });

  it('создаёт объект и возвращает его в списке владельца', async () => {
    const created = await service.create({ type: 'document', title: 'Паспорт' }, userA);
    const list = await service.list(userA);
    expect(list.map((o) => o.id)).toContain(created.id);
  });

  it('изолирует данные между пользователями (row-level)', async () => {
    await service.create({ type: 'document', title: 'Паспорт A' }, userA);
    expect(await service.list(userB)).toHaveLength(0);
  });

  it('чужой пользователь не может получить объект по id', async () => {
    const created = await service.create({ type: 'document', title: 'Личное' }, userA);
    await expect(service.get(created.id, userB)).rejects.toThrow();
  });

  it('обновление бампит версию и меняет поля', async () => {
    const created = await service.create({ type: 'subscription', title: 'Облако' }, userA);
    const updated = await service.update(created.id, { title: 'Облако 2 ТБ' }, userA);
    expect(updated.version).toBe(1);
    expect(updated.title).toBe('Облако 2 ТБ');
  });

  it('soft-delete убирает объект из списка', async () => {
    const created = await service.create({ type: 'document', title: 'Старое' }, userA);
    await service.remove(created.id, userA);
    expect(await service.list(userA)).toHaveLength(0);
  });

  it('нельзя удалить чужой объект', async () => {
    const created = await service.create({ type: 'document', title: 'Чужое' }, userA);
    await expect(service.remove(created.id, userB)).rejects.toThrow();
  });
});
