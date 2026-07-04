import type { CreateLifeObjectInput, LifeObject } from '@life-os/domain';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Запрос не удался (${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  listObjects: () => req<LifeObject[]>('/objects'),
  createObject: (input: CreateLifeObjectInput) =>
    req<LifeObject>('/objects', { method: 'POST', body: JSON.stringify(input) }),
  deleteObject: (id: string) => req<void>(`/objects/${id}`, { method: 'DELETE' }),
};
