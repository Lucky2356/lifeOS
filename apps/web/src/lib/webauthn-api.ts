import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { LoginResult } from '@life-os/domain';
import { apiFetch } from './http';

/** Клиентские церемонии WebAuthn/passkey (второй фактор). Требуют secure context (HTTPS/localhost). */
export const webauthnApi = {
  /** Доступна ли платформенная поддержка WebAuthn. */
  supported(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  },

  /** Зарегистрировать новый passkey у текущего (аутентифицированного) пользователя. */
  async registerPasskey(): Promise<void> {
    const { options, challengeToken } = await apiFetch<{
      options: PublicKeyCredentialCreationOptionsJSON;
      challengeToken: string;
    }>('/auth/webauthn/register/options', { method: 'POST' });
    const response = await startRegistration({ optionsJSON: options });
    await apiFetch('/auth/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify({ response, challengeToken }),
    });
  },

  /** Пройти второй фактор по passkey. mfaChallengeToken — из шага login (status: mfa_required). */
  async authenticate(mfaChallengeToken: string): Promise<LoginResult> {
    const { options, challengeToken } = await apiFetch<{
      options: PublicKeyCredentialRequestOptionsJSON;
      challengeToken: string;
    }>('/auth/webauthn/authenticate/options', {
      method: 'POST',
      body: JSON.stringify({ challengeToken: mfaChallengeToken }),
    });
    const response = await startAuthentication({ optionsJSON: options });
    return apiFetch<LoginResult>('/auth/webauthn/authenticate/verify', {
      method: 'POST',
      body: JSON.stringify({ response, challengeToken }),
    });
  },

  listCredentials: () => apiFetch<{ id: string; createdAt: string }[]>('/auth/webauthn/credentials'),
};
