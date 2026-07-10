import type { Attachment } from '@life-os/domain';
import { apiFetch, apiRequest } from './http';

export const attachmentsApi = {
  list: (objectId: string) => apiFetch<Attachment[]>(`/objects/${objectId}/attachments`),

  async upload(objectId: string, file: File): Promise<Attachment> {
    const form = new FormData();
    form.append('file', file);
    const res = await apiRequest(`/objects/${objectId}/attachments`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Attachment;
  },

  remove: (id: string) => apiFetch<void>(`/attachments/${id}`, { method: 'DELETE' }),

  /** Скачивание требует Authorization — тянем как blob и отдаём object URL. */
  async blobUrl(id: string): Promise<string> {
    const res = await apiRequest(`/attachments/${id}`, { method: 'GET' });
    if (!res.ok) throw new Error(String(res.status));
    return URL.createObjectURL(await res.blob());
  },
};
