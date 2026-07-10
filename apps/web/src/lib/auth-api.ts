import type { LoginResult, PublicUser } from '@life-os/domain';
import { apiFetch } from './http';

export interface SessionInfo {
  id: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
}

export const authApi = {
  register: (email: string, password: string) =>
    apiFetch<LoginResult>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    apiFetch<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  mfaVerify: (challengeToken: string, code: string) =>
    apiFetch<LoginResult>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    }),
  mfaSetup: () => apiFetch<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' }),
  mfaEnable: (code: string) =>
    apiFetch<PublicUser>('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  sessions: () => apiFetch<SessionInfo[]>('/auth/sessions'),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    apiFetch<{ status: string }>('/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    apiFetch<void>('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};
