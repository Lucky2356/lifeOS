import type { CreateDecisionInput, Decision, UpdateDecisionInput } from '@life-os/domain';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`Запрос не удался (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const decisionApi = {
  list: () => req<Decision[]>('/decisions'),
  get: (id: string) => req<Decision>(`/decisions/${id}`),
  create: (input: CreateDecisionInput) =>
    req<Decision>('/decisions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, patch: UpdateDecisionInput) =>
    req<Decision>(`/decisions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => req<void>(`/decisions/${id}`, { method: 'DELETE' }),
};
