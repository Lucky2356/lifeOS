import type { Playbook, PlaybookProgress } from '@life-os/domain';
import { apiFetch as req } from './http';

export const contentApi = {
  playbooks: (kind?: 'crisis' | 'bureaucracy') =>
    req<Playbook[]>(`/content/playbooks${kind ? `?kind=${kind}` : ''}`),
  playbook: (key: string) => req<Playbook>(`/content/playbooks/${key}`),
  start: (key: string) => req<PlaybookProgress>(`/content/playbooks/${key}/start`, { method: 'POST' }),
  progress: () => req<PlaybookProgress[]>('/content/progress'),
  toggleStep: (progressId: string, stepKey: string) =>
    req<PlaybookProgress>(`/content/progress/${progressId}/steps/${stepKey}/toggle`, { method: 'POST' }),
};
