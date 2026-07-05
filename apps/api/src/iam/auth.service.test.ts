import { describe, it, expect, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import * as OTPAuth from 'otpauth';
import { AuthService } from './auth.service';

const genCode = (base32: string) =>
  new OTPAuth.TOTP({
    issuer: 'Life OS',
    label: 'Life OS',
    secret: OTPAuth.Secret.fromBase32(base32),
  }).generate();
import { InMemoryUserRepository } from './user.repository';
import { InMemorySessionRepository } from './session.repository';

const ua = 'test-agent';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(
      new InMemoryUserRepository(),
      new InMemorySessionRepository(),
      new JwtService({ secret: 'test-secret' }),
    );
  });

  it('регистрация выдаёт токены и публичный профиль без секретов', async () => {
    const res = await service.register('a@b.co', 'password1', ua);
    expect(res.status).toBe('authenticated');
    if (res.status !== 'authenticated') return;
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toContain('.');
    expect(res.user.email).toBe('a@b.co');
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('повторная регистрация той же почты отклоняется', async () => {
    await service.register('a@b.co', 'password1', ua);
    await expect(service.register('a@b.co', 'password1', ua)).rejects.toThrow();
  });

  it('логин с неверным паролем отклоняется', async () => {
    await service.register('a@b.co', 'password1', ua);
    await expect(service.login('a@b.co', 'wrong', ua)).rejects.toThrow();
  });

  it('MFA: после включения логин требует второй фактор, верный код выдаёт токены', async () => {
    const reg = await service.register('a@b.co', 'password1', ua);
    if (reg.status !== 'authenticated') throw new Error('no auth');
    const userId = reg.user.id;

    const { secret } = await service.mfaSetup(userId);
    await service.mfaEnable(userId, genCode(secret));

    const login = await service.login('a@b.co', 'password1', ua);
    expect(login.status).toBe('mfa_required');
    if (login.status !== 'mfa_required') return;

    const verified = await service.mfaVerify(login.challengeToken, genCode(secret), ua);
    expect(verified.status).toBe('authenticated');
  });

  it('refresh ротирует токен: старый refresh становится недействительным', async () => {
    const reg = await service.register('a@b.co', 'password1', ua);
    if (reg.status !== 'authenticated') throw new Error('no auth');

    const rotated = await service.refresh(reg.refreshToken, ua);
    expect(rotated.status).toBe('authenticated');
    await expect(service.refresh(reg.refreshToken, ua)).rejects.toThrow();
  });

  it('отзыв сессии делает refresh недействительным', async () => {
    const reg = await service.register('a@b.co', 'password1', ua);
    if (reg.status !== 'authenticated') throw new Error('no auth');
    const [sessionId] = reg.refreshToken.split('.');
    await service.revokeSession(reg.user.id, sessionId!);
    await expect(service.refresh(reg.refreshToken, ua)).rejects.toThrow();
  });
});
