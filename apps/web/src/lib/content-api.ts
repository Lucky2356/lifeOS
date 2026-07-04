import type { Playbook, PlaybookProgress } from '@life-os/domain';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`Запрос не удался (${res.status})`);
  return (await res.json()) as T;
}

export const contentApi = {
  playbooks: (kind?: 'crisis' | 'bureaucracy') =>
    req<Playbook[]>(`/content/playbooks${kind ? `?kind=${kind}` : ''}`),
  playbook: (key: string) => req<Playbook>(`/content/playbooks/${key}`),
  start: (key: string) => req<PlaybookProgress>(`/content/playbooks/${key}/start`, { method: 'POST' }),
  progress: () => req<PlaybookProgress[]>('/content/progress'),
  toggleStep: (progressId: string, stepKey: string) =>
    req<PlaybookProgress>(`/content/progress/${progressId}/steps/${stepKey}/toggle`, { method: 'POST' }),
};
