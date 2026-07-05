import type { AiModule, AiSettings, AiSuggestion, UpdateAiSettings } from '@life-os/domain';
import { apiFetch, apiRequest } from './http';

export type SuggestResult =
  { ok: true; suggestion: AiSuggestion } | { ok: false; reason: 'disabled' | 'error' };

export const aiApi = {
  getSettings: () => apiFetch<AiSettings>('/ai/settings'),
  updateSettings: (patch: UpdateAiSettings) =>
    apiFetch<AiSettings>('/ai/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  suggest: async (module: AiModule, action: string, context = ''): Promise<SuggestResult> => {
    const res = await apiRequest('/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ module, action, context }),
    });
    if (res.status === 409) return { ok: false, reason: 'disabled' };
    if (!res.ok) return { ok: false, reason: 'error' };
    return { ok: true, suggestion: (await res.json()) as AiSuggestion };
  },
};
