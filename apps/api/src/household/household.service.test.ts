import { describe, it, expect, beforeEach } from 'vitest';
import { createHouseholdTask, toggleTaskStatus } from '@life-os/domain';
import { HouseholdService } from './household.service';
import { InMemoryHouseholdRepository } from './in-memory-household.repository';
import { InMemoryUserRepository, type User } from '../iam/user.repository';

const owner = '00000000-0000-0000-0000-0000000000a1';
const stranger = '00000000-0000-0000-0000-0000000000b2';
const childUser = '00000000-0000-0000-0000-0000000000c3';

describe('HouseholdService', () => {
  let service: HouseholdService;
  let usersRepo: InMemoryUserRepository;

  beforeEach(() => {
    usersRepo = new InMemoryUserRepository();
    service = new HouseholdService(new InMemoryHouseholdRepository(), usersRepo);
  });

  function seedUser(id: string, email: string): Promise<User> {
    return usersRepo.create({
      id,
      email,
      passwordHash: 'x',
      mfaEnabled: false,
      mfaSecretEnc: null,
      status: 'active',
      locale: 'ru',
      createdAt: new Date().toISOString(),
    });
  }

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
    await expect(service.createTask(h.id, childUser, { title: 'Задача' })).rejects.toThrow();
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

  it('upsert задачи создаёт её офлайн-стилем и применяет LWW по version', async () => {
    const h = await newHouse();
    const task = createHouseholdTask({ title: 'Полить цветы' }, h.id);
    await service.upsertTask(h.id, owner, task);
    expect((await service.listTasks(h.id, owner)).map((t) => t.id)).toContain(task.id);
    const done = toggleTaskStatus(task); // version 1
    await service.upsertTask(h.id, owner, done);
    const stale = { ...task, title: 'Старое' }; // version 0 — не должно затереть
    await service.upsertTask(h.id, owner, stale);
    const current = (await service.listTasks(h.id, owner)).find((t) => t.id === task.id);
    expect(current?.status).toBe('done');
    expect(current?.title).toBe('Полить цветы');
  });

  it('посторонний не может доливать задачу в чужой дом', async () => {
    const h = await newHouse();
    const task = createHouseholdTask({ title: 'X' }, h.id);
    await expect(service.upsertTask(h.id, stranger, task)).rejects.toThrow();
  });

  it('приглашает зарегистрированного пользователя по e-mail со статусом и ролью по умолчанию', async () => {
    const h = await newHouse();
    await seedUser(childUser, 'kid@example.com');
    const m = await service.addMemberByEmail(h.id, owner, {
      email: 'kid@example.com',
      relationship: 'child',
    });
    expect(m.userId).toBe(childUser);
    expect(m.relationship).toBe('child');
    expect(m.role).toBe('child'); // роль по умолчанию из статуса «ребёнок»
    const members = await service.listMembers(h.id, owner);
    expect(members.map((x) => x.userId)).toContain(childUser);
  });

  it('приглашение незарегистрированной почты отклоняется', async () => {
    const h = await newHouse();
    await expect(
      service.addMemberByEmail(h.id, owner, { email: 'nobody@example.com', relationship: 'friend' }),
    ).rejects.toThrow();
  });

  it('ребёнок не видит журнал доступа', async () => {
    const h = await newHouse();
    await service.addMember(h.id, owner, { userId: childUser, displayName: 'Даша', role: 'child' });
    await expect(service.listAudit(h.id, childUser)).rejects.toThrow();
  });
});
