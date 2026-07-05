import type { CreateLifeObjectInput, LifeObject, UpdateLifeObjectInput } from '@life-os/domain';
import { apiFetch as req } from './http';

export const api = {
  listObjects: () => req<LifeObject[]>('/objects'),
  getObject: (id: string) => req<LifeObject>(`/objects/${id}`),
  createObject: (input: CreateLifeObjectInput) =>
    req<LifeObject>('/objects', { method: 'POST', body: JSON.stringify(input) }),
  updateObject: (id: string, patch: UpdateLifeObjectInput) =>
    req<LifeObject>(`/objects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteObject: (id: string) => req<void>(`/objects/${id}`, { method: 'DELETE' }),
};
