import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Идентификатор аутентифицированного пользователя (устанавливается JwtAuthGuard). */
export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ user?: { userId: string } }>();
  if (!req.user?.userId) throw new UnauthorizedException();
  return req.user.userId;
});

export const CurrentSessionId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ user?: { sessionId: string } }>();
  if (!req.user?.sessionId) throw new UnauthorizedException();
  return req.user.sessionId;
});
