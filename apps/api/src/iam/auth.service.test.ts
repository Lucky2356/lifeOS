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
import { InMemoryResetTokenRepository } from './reset-token.repository';
import { EmailService } from './email.service';

const ua = 'test-agent';

describe('AuthService', () => {
  let service: AuthService;
  let users: InMemoryUserRepository;
  let resetTokens: InMemoryResetTokenRepository;
  let capturedResetUrl: string;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    resetTokens = new InMemoryResetTokenRepository();
    capturedResetUrl = '';
    const email = new EmailService();
    email.sendPasswordReset = async (_to, url) => {
      capturedResetUrl = url;
    };
    service = new AuthService(
      users,
      new InMemorySessionRepository(),
      resetTokens,
      email,
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

  it('сброс пароля по токену: новый пароль работает, старый — нет', async () => {
    await service.register('a@b.co', 'password1', ua);
    await service.requestPasswordReset('a@b.co');
    const token = new URL(capturedResetUrl).searchParams.get('reset')!;
    expect(token.length).toBeGreaterThan(10);

    await service.resetPassword(token, 'newpassword2');
    const ok = await service.login('a@b.co', 'newpassword2', ua);
    expect(ok.status).toBe('authenticated');
    await expect(service.login('a@b.co', 'password1', ua)).rejects.toThrow();
  });

  it('запрос сброса для несуществующего e-mail не раскрывает и не падает', async () => {
    await expect(service.requestPasswordReset('nobody@x.co')).resolves.toBeUndefined();
    expect(capturedResetUrl).toBe(''); // письмо не отправлялось
  });

  it('повторное использование токена сброса отклоняется', async () => {
    await service.register('a@b.co', 'password1', ua);
    await service.requestPasswordReset('a@b.co');
    const token = new URL(capturedResetUrl).searchParams.get('reset')!;
    await service.resetPassword(token, 'newpassword2');
    await expect(service.resetPassword(token, 'another3pass')).rejects.toThrow();
  });
});
