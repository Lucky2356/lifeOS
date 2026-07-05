import type { AiModule, AiSettings, AiSuggestion, UpdateAiSettings } from '@life-os/domain';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`Запрос не удался (${res.status})`);
  return (await res.json()) as T;
}

export type SuggestResult =
  { ok: true; suggestion: AiSuggestion } | { ok: false; reason: 'disabled' | 'error' };

export const aiApi = {
  getSettings: () => req<AiSettings>('/ai/settings'),
  updateSettings: (patch: UpdateAiSettings) =>
    req<AiSettings>('/ai/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  suggest: async (module: AiModule, action: string, context = ''): Promise<SuggestResult> => {
    const res = await fetch(`${BASE}/ai/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module, action, context }),
    });
    if (res.status === 409) return { ok: false, reason: 'disabled' };
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, suggestion: (await res.json()) as AiSuggestion };
  },
};
