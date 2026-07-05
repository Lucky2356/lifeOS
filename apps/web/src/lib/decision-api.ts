import type { CreateDecisionInput, Decision, UpdateDecisionInput } from '@life-os/domain';
import { apiFetch as req } from './http';

export const decisionApi = {
  list: () => req<Decision[]>('/decisions'),
  get: (id: string) => req<Decision>(`/decisions/${id}`),
  create: (input: CreateDecisionInput) =>
    req<Decision>('/decisions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, patch: UpdateDecisionInput) =>
    req<Decision>(`/decisions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => req<void>(`/decisions/${id}`, { method: 'DELETE' }),
};
