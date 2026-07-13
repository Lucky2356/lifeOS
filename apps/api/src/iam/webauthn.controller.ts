import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { CurrentUserId } from '../common/current-user.decorator';
import { AuthService } from './auth.service';
import { WebauthnService } from './webauthn.service';
import { Public } from './public.decorator';
import { applyAuthResult } from './auth-cookie';

const tightThrottle = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth/webauthn')
export class WebauthnController {
  constructor(
    private readonly webauthn: WebauthnService,
    private readonly auth: AuthService,
  ) {}

  // --- Регистрация passkey (аутентифицированный пользователь) ---

  @Post('register/options')
  registerOptions(@CurrentUserId() userId: string) {
    return this.webauthn.registrationOptions(userId);
  }

  @Post('register/verify')
  registerVerify(
    @CurrentUserId() userId: string,
    @Body() body: { response: RegistrationResponseJSON; challengeToken: string },
  ) {
    return this.webauthn.registrationVerify(userId, body.response, body.challengeToken);
  }

  @Get('credentials')
  credentials(@CurrentUserId() userId: string) {
    return this.webauthn.listForUser(userId);
  }

  // --- Аутентификация по passkey (второй фактор; публичные, шаг после mfa_required) ---

  @Public()
  @Throttle(tightThrottle)
  @Post('authenticate/options')
  authOptions(@Body() body: { challengeToken: string }) {
    // challengeToken — mfa-токен из шага login (typ:'mfa'); userId берём из него в сервисе AuthService.
    const userId = this.auth.userIdFromMfaChallenge(body.challengeToken);
    return this.webauthn.authenticationOptions(userId);
  }

  @Public()
  @Throttle(tightThrottle)
  @Post('authenticate/verify')
  async authVerify(
    @Body() body: { response: AuthenticationResponseJSON; challengeToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('user-agent') ua = 'unknown',
  ) {
    const userId = await this.webauthn.authenticationVerify(body.response, body.challengeToken);
    return applyAuthResult(req, res, await this.auth.issueSessionForUser(userId, ua));
  }
}
