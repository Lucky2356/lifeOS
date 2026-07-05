import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InMemoryUserRepository, USER_REPOSITORY } from './user.repository';
import { InMemorySessionRepository, SESSION_REPOSITORY } from './session.repository';

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-insecure-jwt-secret' }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: SESSION_REPOSITORY, useClass: InMemorySessionRepository },
    // Глобальные guard-ы: сначала rate-limit, затем аутентификация.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class IamModule {}
