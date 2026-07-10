import {
  createHouseholdTask,
  toggleTaskStatus,
  type AuditEntry,
  type CreateHouseholdTaskInput,
  type Household,
  type HouseholdTask,
  type Membership,
  type Relationship,
  type Role,
} from '@life-os/domain';
import { apiFetch } from './http';
import { enqueue, pendingPaths } from './offline-core';

/**
 * Offline-first слой Household OS (ADR 0003). Общие задачи (create/toggle) работают офлайн с
 * доливом через upsert по клиентскому id (LWW по version). Списки кэшируются для чтения офлайн.
 * Структурные операции (создать дом, добавить участника) требуют сети — их id/аудит/RBAC формирует
 * сервер.
 */

function readList<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}
function writeList<T>(key: string, list: T[]) {
  localStorage.setItem(key, JSON.stringify(list));
}
const tasksKey = (id: string) => `los-htasks-${id}`;

function putTask(householdId: string, task: HouseholdTask) {
  const list = readList<HouseholdTask>(tasksKey(householdId)).filter((t) => t.id !== task.id);
  list.push(task);
  writeList(tasksKey(householdId), list);
}

export const offlineHousehold = {
  async listMine(): Promise<Household[]> {
    try {
      const hs = await apiFetch<Household[]>('/households');
      writeList('los-households-cache', hs);
      return hs;
    } catch {
      return readList<Household>('los-households-cache');
    }
  },

  create: (name: string, displayName: string) =>
    apiFetch<Household>('/households', { method: 'POST', body: JSON.stringify({ name, displayName }) }),

  async members(id: string): Promise<Membership[]> {
    try {
      const m = await apiFetch<Membership[]>(`/households/${id}/members`);
      writeList(`los-members-${id}`, m);
      return m;
    } catch {
      return readList<Membership>(`los-members-${id}`);
    }
  },

  addMember: (
    id: string,
    body: { userId: string; displayName: string; role: Role; relationship: Relationship },
  ) => apiFetch<Membership>(`/households/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),

  /** Пригласить уже зарегистрированного пользователя по e-mail. */
  invite: (
    id: string,
    body: { email: string; relationship: Relationship; displayName?: string; role?: Role },
  ) =>
    apiFetch<Membership>(`/households/${id}/members/invite`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  async tasks(id: string): Promise<HouseholdTask[]> {
    try {
      const server = await apiFetch<HouseholdTask[]>(`/households/${id}/tasks`);
      const pending = pendingPaths();
      const keep = readList<HouseholdTask>(tasksKey(id)).filter((t) =>
        pending.has(`/households/${id}/tasks/${t.id}`),
      );
      const merged = [...keep, ...server.filter((s) => !keep.some((k) => k.id === s.id))];
      writeList(tasksKey(id), merged);
      return merged;
    } catch {
      return readList<HouseholdTask>(tasksKey(id));
    }
  },

  async createTask(id: string, input: CreateHouseholdTaskInput): Promise<HouseholdTask> {
    const task = createHouseholdTask(input, id);
    putTask(id, task);
    enqueue({ path: `/households/${id}/tasks/${task.id}`, method: 'PUT', body: JSON.stringify(task) });
    return task;
  },

  async toggleTask(id: string, taskId: string): Promise<HouseholdTask> {
    const current = readList<HouseholdTask>(tasksKey(id)).find((t) => t.id === taskId);
    if (!current) throw new Error('Задача не найдена в кэше');
    const toggled = toggleTaskStatus(current);
    putTask(id, toggled);
    enqueue({ path: `/households/${id}/tasks/${toggled.id}`, method: 'PUT', body: JSON.stringify(toggled) });
    return toggled;
  },

  async audit(id: string): Promise<AuditEntry[]> {
    try {
      const a = await apiFetch<AuditEntry[]>(`/households/${id}/audit`);
      writeList(`los-audit-${id}`, a);
      return a;
    } catch {
      return readList<AuditEntry>(`los-audit-${id}`);
    }
  },
};
