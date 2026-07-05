import { z } from 'zod';

/** Идентификация и доступ (IAM). Здесь — только общие для клиента и сервера типы/валидация.
 * Секреты (хэш пароля, TOTP-секрет) живут исключительно на сервере. */

export const emailSchema = z.string().email().max(200);
export const passwordSchema = z.string().min(8).max(200);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const mfaVerifyInputSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(6),
});
export type MfaVerifyInput = z.infer<typeof mfaVerifyInputSchema>;

/** Профиль пользователя, безопасный для отдачи клиенту (без секретов). */
export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  mfaEnabled: z.boolean(),
  locale: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

/** Ответ логина: либо токены, либо требование второго фактора. */
export type LoginResult =
  | { status: 'authenticated'; accessToken: string; refreshToken: string; user: PublicUser }
  | { status: 'mfa_required'; challengeToken: string };
