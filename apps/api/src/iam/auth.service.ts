import { randomBytes } from 'node:crypto';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import * as OTPAuth from 'otpauth';
import { newId, type LoginResult, type PublicUser } from '@life-os/domain';
import { decryptSecret, encryptSecret, sha256 } from '../common/crypto';
import { USER_REPOSITORY, type User, type UserRepository } from './user.repository';
import { SESSION_REPOSITORY, type Session, type SessionRepository } from './session.repository';
import { RESET_TOKEN_REPOSITORY, type ResetTokenRepository } from './reset-token.repository';
import { EmailService } from './email.service';

function totpFor(base32Secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'Life OS',
    label,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

function verifyTotp(base32Secret: string, token: string): boolean {
  return totpFor(base32Secret, 'Life OS').validate({ token, window: 1 }) !== null;
}

const ACCESS_TTL = '15m';
const CHALLENGE_TTL = '5m';
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(RESET_TOKEN_REPOSITORY) private readonly resetTokens: ResetTokenRepository,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
  ) {}

  private toPublic(u: User): PublicUser {
    return { id: u.id, email: u.email, mfaEnabled: u.mfaEnabled, locale: u.locale };
  }

  async register(email: string, password: string, userAgent: string): Promise<LoginResult> {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Пользователь с такой почтой уже есть');
    const now = new Date().toISOString();
    const user: User = {
      id: newId(),
      email,
      passwordHash: await argonHash(password),
      mfaEnabled: false,
      mfaSecretEnc: null,
      status: 'active',
      locale: 'ru',
      createdAt: now,
      notifyEmail: true,
    };
    await this.users.create(user);
    return this.issueSession(user, userAgent);
  }

  async login(email: string, password: string, userAgent: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    // Единообразная ошибка — защита от enumeration.
    const invalid = new UnauthorizedException('Неверная почта или пароль');
    if (!user) {
      await argonHash(password); // выравниваем время ответа
      throw invalid;
    }
    const ok = await argonVerify(user.passwordHash, password);
    if (!ok) throw invalid;

    if (user.mfaEnabled) {
      const challengeToken = await this.jwt.signAsync(
        { sub: user.id, typ: 'mfa' },
        { expiresIn: CHALLENGE_TTL },
      );
      return { status: 'mfa_required', challengeToken };
    }
    return this.issueSession(user, userAgent);
  }

  async mfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.mustUser(userId);
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    user.mfaSecretEnc = encryptSecret(secret);
    await this.users.save(user);
    return { secret, otpauthUrl: totpFor(secret, user.email).toString() };
  }

  async mfaEnable(userId: string, code: string): Promise<PublicUser> {
    const user = await this.mustUser(userId);
    if (!user.mfaSecretEnc) throw new UnauthorizedException('Сначала настройте MFA');
    if (!verifyTotp(decryptSecret(user.mfaSecretEnc), code)) {
      throw new UnauthorizedException('Неверный код');
    }
    user.mfaEnabled = true;
    await this.users.save(user);
    return this.toPublic(user);
  }

  async mfaVerify(challengeToken: string, code: string, userAgent: string): Promise<LoginResult> {
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(challengeToken);
      if (payload.typ !== 'mfa') throw new Error('bad type');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Сессия входа истекла, войдите заново');
    }
    const user = await this.mustUser(userId);
    if (!user.mfaSecretEnc || !verifyTotp(decryptSecret(user.mfaSecretEnc), code)) {
      throw new UnauthorizedException('Неверный код');
    }
    return this.issueSession(user, userAgent);
  }

  async refresh(refreshToken: string, userAgent: string): Promise<LoginResult> {
    const [sessionId, secret] = refreshToken.split('.');
    const invalid = new UnauthorizedException('Сессия недействительна');
    if (!sessionId || !secret) throw invalid;
    const session = await this.sessions.findById(sessionId);
    if (!session || session.revokedAt !== null) throw invalid;
    if (new Date(session.expiresAt).getTime() < Date.now()) throw invalid;
    if (session.refreshHash !== sha256(secret)) throw invalid;

    const user = await this.mustUser(session.userId);
    // Ротация refresh-секрета.
    const newSecret = randomBytes(32).toString('hex');
    session.refreshHash = sha256(newSecret);
    session.lastSeenAt = new Date().toISOString();
    session.userAgent = userAgent;
    await this.sessions.save(session);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { expiresIn: ACCESS_TTL },
    );
    return {
      status: 'authenticated',
      accessToken,
      refreshToken: `${session.id}.${newSecret}`,
      user: this.toPublic(user),
    };
  }

  async listSessions(userId: string): Promise<Array<Omit<Session, 'refreshHash'>>> {
    const list = await this.sessions.listByUser(userId);
    return list.map(({ refreshHash: _hash, ...rest }) => rest);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (session && session.userId === userId && session.revokedAt === null) {
      session.revokedAt = new Date().toISOString();
      await this.sessions.save(session);
    }
  }

  /**
   * Запрос сброса пароля. Всегда завершается одинаково (без раскрытия, есть ли такой e-mail).
   * Если пользователь существует — создаём одноразовый токен (TTL 1ч) и шлём ссылку на почту.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) return;
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    await this.resetTokens.create({
      id: newId(),
      userId: user.id,
      tokenHash: sha256(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
      usedAt: null,
    });
    const appUrl = (process.env.APP_URL ?? 'http://localhost:8080').replace(/\/$/, '');
    await this.email.sendPasswordReset(user.email, `${appUrl}/?reset=${token}`);
  }

  /** Установить новый пароль по токену из письма. Одноразово, инвалидирует все сессии. */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const rec = await this.resetTokens.findByHash(sha256(token));
    const invalid = new UnauthorizedException('Ссылка сброса недействительна или устарела');
    if (!rec || rec.usedAt !== null) throw invalid;
    if (new Date(rec.expiresAt).getTime() < Date.now()) throw invalid;

    const user = await this.mustUser(rec.userId);
    user.passwordHash = await argonHash(newPassword);
    await this.users.save(user);
    await this.resetTokens.markUsed(rec.id, new Date());

    // Безопасность: после смены пароля все активные сессии отзываются.
    const sessions = await this.sessions.listByUser(user.id);
    const now = new Date().toISOString();
    for (const s of sessions) {
      if (s.revokedAt === null) await this.sessions.save({ ...s, revokedAt: now });
    }
  }

  /** Выдать сессию по userId (для завершения второго фактора через passkey/WebAuthn). */
  async issueSessionForUser(userId: string, userAgent: string): Promise<LoginResult> {
    return this.issueSession(await this.mustUser(userId), userAgent);
  }

  /** Извлечь userId из mfa-challenge токена (шаг второго фактора). */
  userIdFromMfaChallenge(challengeToken: string): string {
    try {
      const payload = this.jwt.verify<{ sub: string; typ: string }>(challengeToken);
      if (payload.typ !== 'mfa') throw new Error('bad type');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Сессия входа истекла, войдите заново');
    }
  }

  private async issueSession(user: User, userAgent: string): Promise<LoginResult> {
    const now = new Date();
    const secret = randomBytes(32).toString('hex');
    const session: Session = {
      id: newId(),
      userId: user.id,
      refreshHash: sha256(secret),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000).toISOString(),
      revokedAt: null,
      lastSeenAt: now.toISOString(),
      userAgent,
    };
    await this.sessions.create(session);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { expiresIn: ACCESS_TTL },
    );
    return {
      status: 'authenticated',
      accessToken,
      refreshToken: `${session.id}.${secret}`,
      user: this.toPublic(user),
    };
  }

  private async mustUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    return user;
  }
}
