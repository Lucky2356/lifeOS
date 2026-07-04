import { describe, it, expect, beforeEach } from 'vitest';
import { HouseholdService } from './household.service';
import { InMemoryHouseholdRepository } from './in-memory-household.repository';

const owner = '00000000-0000-0000-0000-0000000000a1';
const stranger = '00000000-0000-0000-0000-0000000000b2';
const childUser = '00000000-0000-0000-0000-0000000000c3';

describe('HouseholdService', () => {
  let service: HouseholdService;

  beforeEach(() => {
    service = new HouseholdService(new InMemoryHouseholdRepository());
  });

  async function newHouse() {
    return service.create('Наш дом', owner, 'Алекс');
  }

  it('создатель становится владельцем', async () => {
    const h = await newHouse();
    const members = await service.listMembers(h.id, owner);
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe('owner');
  });

  it('посторонний не имеет доступа к дому', async () => {
    const h = await newHouse();
    await expect(service.get(h.id, stranger)).rejects.toThrow();
    await expect(service.listTasks(h.id, stranger)).rejects.toThrow();
  });

  it('владелец добавляет ребёнка; ребёнок не может создавать задачи', async () => {
    const h = await newHouse();
    await service.addMember(h.id, owner, { userId: childUser, displayName: 'Даша', role: 'child' });
    await expect(
      service.createTask(h.id, childUser, { title: 'Задача' }),
    ).rejects.toThrow();
  });

  it('ребёнок не может добавлять участников', async () => {
    const h = await newHouse();
    await service.addMember(h.id, owner, { userId: childUser, displayName: 'Даша', role: 'child' });
    await expect(
      service.addMember(h.id, childUser, { userId: stranger, displayName: 'X', role: 'guest' }),
    ).rejects.toThrow();
  });

  it('создание задачи попадает в журнал доступа', async () => {
    const h = await newHouse();
    await service.createTask(h.id, owner, { title: 'Купить хлеб' });
    const audit = await service.listAudit(h.id, owner);
    expect(audit.some((e) => e.action === 'create_task')).toBe(true);
  });

  it('ребёнок не видит журнал доступа', async () => {
    const h = await newHouse();
    await service.addMember(h.id, owner, { userId: childUser, displayName: 'Даша', role: 'child' });
    await expect(service.listAudit(h.id, childUser)).rejects.toThrow();
  });
});
