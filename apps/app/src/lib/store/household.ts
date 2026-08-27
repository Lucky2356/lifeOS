import {
  createHousehold,
  createHouseholdTask,
  createMembership,
  defaultRoleForRelationship,
  newId,
  toggleTaskStatus,
  type CreateHouseholdTaskInput,
  type Household,
  type HouseholdTask,
  type Membership,
  type Relationship,
  type Repeat,
} from '@life-os/domain';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Household OS в локальном виде (ADR 0006): один дом на устройстве, участники — справочник людей
 * (кому назначена задача), задачи — общий список. Без сервера нет ни приглашений, ни ролевого
 * доступа, ни журнала: разделять данные между людьми на одном устройстве не с кем.
 */

export const householdStore = {
  /** Дом этого устройства (первый и единственный) либо null, если ещё не создан. */
  async current(): Promise<Household | null> {
    const all = await (await db()).getAll('households');
    return all.find((h) => h.deletedAt === null) ?? null;
  },

  /** Создать дом и сразу завести владельца — себя. */
  async create(name: string, displayName: string): Promise<Household> {
    const owner = await ownerUserId();
    const household = createHousehold(name, owner);
    const self = createMembership({
      householdId: household.id,
      userId: owner,
      displayName,
      role: 'owner',
      relationship: 'self',
    });
    const database = await db();
    const tx = database.transaction(['households', 'members'], 'readwrite');
    await Promise.all([
      tx.objectStore('households').put(household),
      tx.objectStore('members').put(self),
      tx.done,
    ]);
    return household;
  },

  async members(householdId: string): Promise<Membership[]> {
    const all = await (await db()).getAllFromIndex('members', 'by-household', householdId);
    return all.filter((m) => m.deletedAt === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** Добавить человека в справочник дома. Аккаунта у него нет — только имя и кто это для вас. */
  async addMember(
    householdId: string,
    input: { displayName: string; relationship: Relationship },
  ): Promise<Membership> {
    const member = createMembership({
      householdId,
      userId: newId(),
      displayName: input.displayName,
      role: defaultRoleForRelationship(input.relationship),
      relationship: input.relationship,
    });
    await (await db()).put('members', member);
    return member;
  },

  /** Убрать человека из справочника; его задачи остаются, но становятся без исполнителя. */
  async removeMember(memberId: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['members', 'tasks'], 'readwrite');
    const tasks = await tx.objectStore('tasks').getAll();
    await Promise.all([
      tx.objectStore('members').delete(memberId),
      ...tasks
        .filter((t) => t.assigneeMembershipId === memberId)
        .map((t) => tx.objectStore('tasks').put({ ...t, assigneeMembershipId: null })),
      tx.done,
    ]);
  },

  async tasks(householdId: string): Promise<HouseholdTask[]> {
    const all = await (await db()).getAllFromIndex('tasks', 'by-household', householdId);
    return all.filter((t) => t.deletedAt === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createTask(householdId: string, input: CreateHouseholdTaskInput): Promise<HouseholdTask> {
    const task = createHouseholdTask(input, householdId);
    await (await db()).put('tasks', task);
    return task;
  },

  async toggleTask(taskId: string): Promise<HouseholdTask> {
    const database = await db();
    const current = await database.get('tasks', taskId);
    if (!current) throw new Error('Задача не найдена');
    const toggled = toggleTaskStatus(current);
    await database.put('tasks', toggled);
    return toggled;
  },

  /** Поправить название, срок или исполнителя уже созданной задачи. */
  async updateTask(
    taskId: string,
    patch: {
      title?: string;
      dueAt?: string | null;
      assigneeMembershipId?: string | null;
      repeat?: Repeat;
    },
  ): Promise<HouseholdTask> {
    const database = await db();
    const current = await database.get('tasks', taskId);
    if (!current) throw new Error('Задача не найдена');
    const updated: HouseholdTask = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    await database.put('tasks', updated);
    return updated;
  },

  async removeTask(taskId: string): Promise<void> {
    await (await db()).delete('tasks', taskId);
  },
};
