import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DRIZZLE, type Database } from '../db/drizzle.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DrizzleUserRepository } from './drizzle-user.repository';
import { DrizzleSessionRepository } from './drizzle-session.repository';
import { DrizzleResetTokenRepository } from './drizzle-reset-token.repository';
import { InMemoryUserRepository, USER_REPOSITORY } from './user.repository';
import { InMemorySessionRepository, SESSION_REPOSITORY } from './session.repository';
import { InMemoryResetTokenRepository, RESET_TOKEN_REPOSITORY } from './reset-token.repository';
import { EmailService } from './email.service';
import { MaintenanceService } from './maintenance.service';
import { WebauthnController } from './webauthn.controller';
import { WebauthnService } from './webauthn.service';
import { DrizzleWebauthnCredentialRepository } from './drizzle-webauthn-credential.repository';
import {
  InMemoryWebauthnCredentialRepository,
  WEBAUTHN_CREDENTIAL_REPOSITORY,
} from './webauthn-credential.repository';

@Module({
  imports: [
    // registerAsync: секрет читается фабрикой на DI-этапе (после ensureSecrets в bootstrap),
    // а не при вычислении декоратора модуля — иначе per-install JWT_SECRET из app_secrets не применялся бы.
    JwtModule.registerAsync({
      useFactory: () => ({ secret: process.env.JWT_SECRET || 'dev-insecure-jwt-secret' }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController, WebauthnController],
  providers: [
    AuthService,
    EmailService,
    MaintenanceService,
    WebauthnService,
    {
      provide: WEBAUTHN_CREDENTIAL_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleWebauthnCredentialRepository(db) : new InMemoryWebauthnCredentialRepository(),
    },
    {
      provide: RESET_TOKEN_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleResetTokenRepository(db) : new InMemoryResetTokenRepository(),
    },
    {
      provide: USER_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleUserRepository(db) : new InMemoryUserRepository(),
    },
    {
      provide: SESSION_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Database | null) =>
        db ? new DrizzleSessionRepository(db) : new InMemorySessionRepository(),
    },
    // Глобальные guard-ы: сначала rate-limit, затем аутентификация.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, USER_REPOSITORY, EmailService],
})
export class IamModule {}
