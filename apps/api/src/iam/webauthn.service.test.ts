import { describe, it, expect, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { WebauthnService } from './webauthn.service';
import { InMemoryUserRepository, type User } from './user.repository';
import { InMemoryWebauthnCredentialRepository } from './webauthn-credential.repository';

const userId = '00000000-0000-0000-0000-0000000000a1';

function mkUser(): User {
  return {
    id: userId,
    email: 'a@b.co',
    passwordHash: 'x',
    mfaEnabled: false,
    mfaSecretEnc: null,
    status: 'active',
    locale: 'ru',
    createdAt: new Date().toISOString(),
    notifyEmail: true,
  };
}

describe('WebauthnService', () => {
  let users: InMemoryUserRepository;
  let creds: InMemoryWebauthnCredentialRepository;
  let jwt: JwtService;
  let service: WebauthnService;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    creds = new InMemoryWebauthnCredentialRepository();
    jwt = new JwtService({ secret: 'test-secret' });
    service = new WebauthnService(users, creds, jwt);
    await users.create(mkUser());
  });

  it('опции регистрации содержат challenge и подписанный challengeToken (wa-reg)', async () => {
    const { options, challengeToken } = await service.registrationOptions(userId);
    expect(options.challenge).toBeTruthy();
    const payload = jwt.verify<{ sub: string; ch: string; typ: string }>(challengeToken);
    expect(payload).toMatchObject({ sub: userId, ch: options.challenge, typ: 'wa-reg' });
  });

  it('опции аутентификации отдают allowCredentials и токен wa-auth', async () => {
    await creds.create({
      id: 'c1',
      userId,
      credentialId: 'Y3JlZA',
      publicKey: 'a2V5',
      counter: 0,
      transports: ['internal'],
      createdAt: new Date().toISOString(),
    });
    const { options, challengeToken } = await service.authenticationOptions(userId);
    expect(options.allowCredentials?.[0]?.id).toBe('Y3JlZA');
    const payload = jwt.verify<{ typ: string }>(challengeToken);
    expect(payload.typ).toBe('wa-auth');
  });

  it('регистрация отклоняется, если challengeToken выдан другому пользователю', async () => {
    const foreign = await jwt.signAsync({ sub: 'other', ch: 'x', typ: 'wa-reg' });
    await expect(service.registrationVerify(userId, {} as never, foreign)).rejects.toThrow();
  });

  it('аутентификация отклоняется при неверном типе токена', async () => {
    const wrong = await jwt.signAsync({ sub: userId, ch: 'x', typ: 'mfa' });
    await expect(service.authenticationVerify({ id: 'Y3JlZA' } as never, wrong)).rejects.toThrow();
  });
});
