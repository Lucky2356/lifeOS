import type {
  AuditEntry,
  CreateHouseholdTaskInput,
  Household,
  HouseholdTask,
  Membership,
  Role,
} from '@life-os/domain';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Запрос не удался (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const householdApi = {
  listMine: () => req<Household[]>('/households'),
  create: (name: string, displayName: string) =>
    req<Household>('/households', { method: 'POST', body: JSON.stringify({ name, displayName }) }),
  members: (id: string) => req<Membership[]>(`/households/${id}/members`),
  addMember: (id: string, body: { userId: string; displayName: string; role: Role }) =>
    req<Membership>(`/households/${id}/members`, { method: 'POST', body: JSON.stringify(body) }),
  tasks: (id: string) => req<HouseholdTask[]>(`/households/${id}/tasks`),
  createTask: (id: string, input: CreateHouseholdTaskInput) =>
    req<HouseholdTask>(`/households/${id}/tasks`, { method: 'POST', body: JSON.stringify(input) }),
  toggleTask: (id: string, taskId: string) =>
    req<HouseholdTask>(`/households/${id}/tasks/${taskId}/toggle`, { method: 'POST' }),
  audit: (id: string) => req<AuditEntry[]>(`/households/${id}/audit`),
};
