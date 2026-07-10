import { apiFetch } from './http';

export const accountApi = {
  getNotifications: () => apiFetch<{ notifyEmail: boolean }>('/account/notifications'),
  setNotifications: (notifyEmail: boolean) =>
    apiFetch<{ notifyEmail: boolean }>('/account/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notifyEmail }),
    }),
};
