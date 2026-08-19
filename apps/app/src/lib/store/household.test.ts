import { describe, it, expect } from 'vitest';
import { householdStore } from './household';

describe('householdStore', () => {
  it('до создания дома его нет', async () => {
    expect(await householdStore.current()).toBeNull();
  });

  it('создание дома сразу заводит владельца', async () => {
    const house = await householdStore.create('Наш дом', 'Алекс');
    expect((await householdStore.current())?.id).toBe(house.id);

    const members = await householdStore.members(house.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ displayName: 'Алекс', role: 'owner', relationship: 'self' });
  });

  it('добавленному ребёнку выдаётся роль ребёнка', async () => {
    const house = await householdStore.create('Наш дом', 'Алекс');
    const kid = await householdStore.addMember(house.id, { displayName: 'Дима', relationship: 'child' });
    expect(kid.role).toBe('child');
    expect(await householdStore.members(house.id)).toHaveLength(2);
  });

  it('задачи переключаются и хранятся по дому', async () => {
    const house = await householdStore.create('Наш дом', 'Алекс');
    const task = await householdStore.createTask(house.id, { title: 'Вынести мусор' });
    expect(task.status).toBe('open');

    const done = await householdStore.toggleTask(task.id);
    expect(done.status).toBe('done');
    expect((await householdStore.tasks(house.id))[0]?.status).toBe('done');

    expect((await householdStore.toggleTask(task.id)).status).toBe('open');
  });

  it('удаление человека снимает его с задач, но задачи остаются', async () => {
    const house = await householdStore.create('Наш дом', 'Алекс');
    const kid = await householdStore.addMember(house.id, { displayName: 'Дима', relationship: 'child' });
    await householdStore.createTask(house.id, { title: 'Уроки', assigneeMembershipId: kid.id });

    await householdStore.removeMember(kid.id);

    const tasks = await householdStore.tasks(house.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assigneeMembershipId).toBeNull();
    expect(await householdStore.members(house.id)).toHaveLength(1);
  });
});
