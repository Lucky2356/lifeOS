import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  loginInputSchema,
  mfaVerifyInputSchema,
  registerInputSchema,
  type LoginInput,
  type MfaVerifyInput,
  type RegisterInput,
} from '@life-os/domain';
import { z } from 'zod';
import { CurrentSessionId, CurrentUserId } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const codeSchema = z.object({ code: z.string().min(6).max(6) });
const tightThrottle = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(tightThrottle)
  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerInputSchema)) body: RegisterInput,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return this.auth.register(body.email, body.password, ua);
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('login')
  login(
    @Body(new ZodValidationPipe(loginInputSchema)) body: LoginInput,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return this.auth.login(body.email, body.password, ua);
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('mfa/verify')
  mfaVerify(
    @Body(new ZodValidationPipe(mfaVerifyInputSchema)) body: MfaVerifyInput,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return this.auth.mfaVerify(body.challengeToken, body.code, ua);
  }

  @Public()
  @Post('token/refresh')
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
    @Headers('user-agent') ua = 'unknown',
  ) {
    return this.auth.refresh(body.refreshToken, ua);
  }

  @Post('mfa/setup')
  mfaSetup(@CurrentUserId() userId: string) {
    return this.auth.mfaSetup(userId);
  }

  @Post('mfa/enable')
  mfaEnable(
    @Body(new ZodValidationPipe(codeSchema)) body: { code: string },
    @CurrentUserId() userId: string,
  ) {
    return this.auth.mfaEnable(userId, body.code);
  }

  @Get('sessions')
  sessions(@CurrentUserId() userId: string) {
    return this.auth.listSessions(userId);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(204)
  revoke(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.auth.revokeSession(userId, id);
  }

  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUserId() userId: string, @CurrentSessionId() sessionId: string) {
    return this.auth.revokeSession(userId, sessionId);
  }
}
