import type {
  AuditEntry,
  CreateHouseholdTaskInput,
  Household,
  HouseholdTask,
  Membership,
  Role,
} from '@life-os/domain';
import { apiFetch as req } from './http';

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
