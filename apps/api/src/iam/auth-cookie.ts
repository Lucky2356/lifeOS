import type { Request, Response } from 'express';
import type { LoginResult } from '@life-os/domain';

/**
 * Куки-режим для веб-клиента: refresh-токен хранится в httpOnly-cookie, недоступной JS (защита от
 * кражи при XSS). Нативные оболочки (Tauri/Capacitor) используют Bearer + refresh в теле — они шлют
 * заголовок `X-Client: native` (или не шлют `web`), и куки им не выставляются.
 */
export const REFRESH_COOKIE = 'los_rt';
const REFRESH_PATH = '/api/v1/auth';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней — как TTL refresh-сессии

/** Веб-клиент (куки-режим) сигнализирует заголовком `X-Client: web`. */
export function isWebClient(req: Request): boolean {
  return req.header('x-client') === 'web';
}

/** Secure-cookie только под HTTPS. За Caddy/nginx смотрим X-Forwarded-Proto; иначе req.secure. */
function isSecure(req: Request): boolean {
  return req.secure || req.header('x-forwarded-proto') === 'https';
}

export function setRefreshCookie(req: Request, res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'strict',
    path: REFRESH_PATH,
    maxAge: MAX_AGE_MS,
  });
}

export function clearRefreshCookie(req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'strict',
    path: REFRESH_PATH,
  });
}

/**
 * Для веб-клиента: положить refresh в httpOnly-cookie и убрать его из тела ответа (JS его не получает).
 * Для нативного клиента — вернуть результат как есть (refresh в теле).
 */
export function applyAuthResult(req: Request, res: Response, result: LoginResult): LoginResult {
  if (isWebClient(req) && result.status === 'authenticated') {
    setRefreshCookie(req, res, result.refreshToken);
    const { refreshToken: _omit, ...rest } = result;
    return rest as LoginResult; // refresh ушёл в cookie, не в теле
  }
  return result;
}
