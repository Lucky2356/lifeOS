import { describe, it, expect } from 'vitest';
import { loginInputSchema, mfaVerifyInputSchema, registerInputSchema } from './iam';

describe('IAM validation', () => {
  it('регистрация требует валидный email и пароль ≥ 8 символов', () => {
    expect(registerInputSchema.safeParse({ email: 'a@b.co', password: '12345678' }).success).toBe(true);
    expect(registerInputSchema.safeParse({ email: 'нет-почты', password: '12345678' }).success).toBe(false);
    expect(registerInputSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });

  it('MFA-код — ровно 6 символов', () => {
    expect(mfaVerifyInputSchema.safeParse({ challengeToken: 'x', code: '123456' }).success).toBe(true);
    expect(mfaVerifyInputSchema.safeParse({ challengeToken: 'x', code: '123' }).success).toBe(false);
  });

  it('логин принимает непустой пароль', () => {
    expect(loginInputSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginInputSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
