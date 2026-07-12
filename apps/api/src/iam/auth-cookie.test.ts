import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE, applyAuthResult, isWebClient } from './auth-cookie';
import type { LoginResult } from '@life-os/domain';

function mkReq(headers: Record<string, string> = {}): Request {
  return { header: (k: string) => headers[k.toLowerCase()], secure: false } as unknown as Request;
}
function mkRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
  };
}

const authed: LoginResult = {
  status: 'authenticated',
  accessToken: 'acc',
  refreshToken: 'rt-secret',
  user: { id: 'u1', email: 'a@b.co', mfaEnabled: false, locale: 'ru' },
};

describe('auth-cookie', () => {
  it('веб-клиент: refresh уходит в httpOnly-cookie и вырезается из тела', () => {
    const req = mkReq({ 'x-client': 'web' });
    const res = mkRes();
    const body = applyAuthResult(req, res, authed);

    expect(isWebClient(req)).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      'rt-secret',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect('refreshToken' in body).toBe(false); // тела не содержит секрет
    expect(body.status === 'authenticated' && body.accessToken).toBe('acc');
  });

  it('нативный клиент: cookie не выставляется, refresh остаётся в теле', () => {
    const req = mkReq({ 'x-client': 'native' });
    const res = mkRes();
    const body = applyAuthResult(req, res, authed);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(body).toEqual(authed);
  });

  it('mfa_required проходит без cookie', () => {
    const req = mkReq({ 'x-client': 'web' });
    const res = mkRes();
    const body = applyAuthResult(req, res, { status: 'mfa_required', challengeToken: 'ch' });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(body).toEqual({ status: 'mfa_required', challengeToken: 'ch' });
  });
});
