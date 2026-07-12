import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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
import { REFRESH_COOKIE, applyAuthResult, clearRefreshCookie, isWebClient } from './auth-cookie';

// refresh для веб-клиента приходит в httpOnly-cookie, для нативного — в теле; поэтому поле опционально.
const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });
const codeSchema = z.object({ code: z.string().min(6).max(6) });
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });
const tightThrottle = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(tightThrottle)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerInputSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return applyAuthResult(req, res, await this.auth.register(body.email, body.password, ua));
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginInputSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return applyAuthResult(req, res, await this.auth.login(body.email, body.password, ua));
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('mfa/verify')
  async mfaVerify(
    @Body(new ZodValidationPipe(mfaVerifyInputSchema)) body: MfaVerifyInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua = 'unknown',
  ) {
    return applyAuthResult(req, res, await this.auth.mfaVerify(body.challengeToken, body.code, ua));
  }

  @Public()
  @Post('token/refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua = 'unknown',
  ) {
    // Веб: токен из httpOnly-cookie; нативный: из тела. Куки-режим неуязвим к CSRF (SameSite=Strict,
    // а новый токен возвращается в теле, недоступном чужому origin из-за CORS).
    const token = isWebClient(req)
      ? (req.cookies?.[REFRESH_COOKIE] as string | undefined)
      : body.refreshToken;
    return applyAuthResult(req, res, await this.auth.refresh(token ?? '', ua));
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('password/forgot')
  @HttpCode(202)
  async forgotPassword(@Body(new ZodValidationPipe(forgotSchema)) body: { email: string }) {
    await this.auth.requestPasswordReset(body.email);
    // Всегда 202 — не раскрываем, зарегистрирован ли e-mail.
    return { status: 'accepted' };
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('password/reset')
  @HttpCode(204)
  resetPassword(@Body(new ZodValidationPipe(resetSchema)) body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
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
  async logout(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    clearRefreshCookie(req, res);
    await this.auth.revokeSession(userId, sessionId);
  }
}
