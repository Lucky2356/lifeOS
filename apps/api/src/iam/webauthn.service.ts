import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { newId } from '@life-os/domain';
import { USER_REPOSITORY, type UserRepository } from './user.repository';
import {
  WEBAUTHN_CREDENTIAL_REPOSITORY,
  type WebauthnCredentialRepository,
} from './webauthn-credential.repository';

/** Конфигурация relying party из окружения (в проде — публичный домен, в dev — localhost). */
function rpConfig(): { rpID: string; rpName: string; origin: string } {
  const appUrl = process.env.WEBAUTHN_ORIGIN ?? process.env.APP_URL ?? 'http://localhost:5173';
  let host = 'localhost';
  try {
    host = new URL(appUrl).hostname;
  } catch {
    /* оставляем localhost */
  }
  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? host,
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Life OS',
    origin: appUrl.replace(/\/$/, ''),
  };
}

const CHALLENGE_TTL = '5m';

@Injectable()
export class WebauthnService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(WEBAUTHN_CREDENTIAL_REPOSITORY) private readonly creds: WebauthnCredentialRepository,
    private readonly jwt: JwtService,
  ) {}

  /** Опции регистрации нового passkey (для аутентифицированного пользователя). */
  async registrationOptions(userId: string) {
    const { rpID, rpName } = rpConfig();
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    const existing = await this.creds.listByUser(userId);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: (c.transports ?? undefined) as never,
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    const challengeToken = await this.jwt.signAsync(
      { sub: userId, ch: options.challenge, typ: 'wa-reg' },
      { expiresIn: CHALLENGE_TTL },
    );
    return { options, challengeToken };
  }

  /** Проверка регистрации passkey и сохранение публичного ключа. Включает второй фактор у пользователя. */
  async registrationVerify(userId: string, response: RegistrationResponseJSON, challengeToken: string) {
    const expectedChallenge = this.readChallenge(challengeToken, 'wa-reg', userId);
    const { rpID, origin } = rpConfig();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Не удалось подтвердить ключ');
    }
    const { credential } = verification.registrationInfo;
    await this.creds.create({
      id: newId(),
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? null,
      createdAt: new Date().toISOString(),
    });
    // Passkey — второй фактor: включаем требование MFA при входе.
    const user = await this.users.findById(userId);
    if (user && !user.mfaEnabled) {
      user.mfaEnabled = true;
      await this.users.save(user);
    }
    return { verified: true };
  }

  /** Опции аутентификации по passkey для пользователя (шаг второго фактора). */
  async authenticationOptions(userId: string) {
    const { rpID } = rpConfig();
    const creds = await this.creds.listByUser(userId);
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: (c.transports ?? undefined) as never,
      })),
      userVerification: 'preferred',
    });
    const challengeToken = await this.jwt.signAsync(
      { sub: userId, ch: options.challenge, typ: 'wa-auth' },
      { expiresIn: CHALLENGE_TTL },
    );
    return { options, challengeToken };
  }

  /** Проверка ответа аутентификации по passkey. Возвращает userId при успехе. */
  async authenticationVerify(response: AuthenticationResponseJSON, challengeToken: string): Promise<string> {
    const payload = this.verifyToken(challengeToken, 'wa-auth');
    const cred = await this.creds.findByCredentialId(response.id);
    if (!cred || cred.userId !== payload.sub) throw new UnauthorizedException('Ключ не распознан');
    const { rpID, origin } = rpConfig();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: payload.ch,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
        counter: cred.counter,
        transports: (cred.transports ?? undefined) as never,
      },
    });
    if (!verification.verified) throw new UnauthorizedException('Проверка ключа не пройдена');
    await this.creds.updateCounter(cred.id, verification.authenticationInfo.newCounter);
    return cred.userId;
  }

  async listForUser(userId: string) {
    return (await this.creds.listByUser(userId)).map((c) => ({ id: c.id, createdAt: c.createdAt }));
  }

  private verifyToken(token: string, typ: string): { sub: string; ch: string } {
    try {
      const payload = this.jwt.verify<{ sub: string; ch: string; typ: string }>(token);
      if (payload.typ !== typ) throw new Error('bad typ');
      return payload;
    } catch {
      throw new UnauthorizedException('Сессия ключа истекла, начните заново');
    }
  }

  private readChallenge(token: string, typ: string, expectedUserId: string): string {
    const payload = this.verifyToken(token, typ);
    if (payload.sub !== expectedUserId) throw new UnauthorizedException('Неверный контекст ключа');
    return payload.ch;
  }
}
