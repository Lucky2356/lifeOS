import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** DEV-ONLY идентификатор пользователя. Настоящая аутентификация/сессии/MFA — отдельный срез Фазы 3 (IAM). */
export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
  const header = req.headers['x-dev-user'];
  return typeof header === 'string' && header.length > 0 ? header : DEV_USER_ID;
});
