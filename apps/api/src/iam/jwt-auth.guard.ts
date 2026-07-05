import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository';

interface AccessPayload {
  sub: string;
  sid?: string;
}

/** Глобальный guard: проверяет Bearer access-токен и активность сессии (реальный отзыв). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { userId: string; sessionId: string };
    }>();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException();

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(auth.slice(7));
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sid) throw new UnauthorizedException(); // challenge-токены сюда не пускаем

    const session = await this.sessions.findById(payload.sid);
    if (!session || session.revokedAt !== null) throw new UnauthorizedException('Сессия отозвана');

    req.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}
