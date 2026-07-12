import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { logger } from '../common/logger';
import { SESSION_REPOSITORY, type SessionRepository } from './session.repository';
import { RESET_TOKEN_REPOSITORY, type ResetTokenRepository } from './reset-token.repository';

/**
 * Гигиена БД: раз в сутки чистит протухшие сессии и использованные/просроченные токены сброса пароля,
 * чтобы таблицы не росли вечно. Идемпотентно; безопасно к повторным запускам.
 */
@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(RESET_TOKEN_REPOSITORY) private readonly resetTokens: ResetTokenRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDaily(): Promise<void> {
    const { sessions, tokens } = await this.run();
    if (sessions > 0 || tokens > 0) {
      logger.info({ sessions, tokens }, 'Гигиена БД: удалены протухшие сессии/токены');
    }
  }

  /** Прогон чистки. Возвращает число удалённых записей (для теста/ручного запуска). */
  async run(now: Date = new Date()): Promise<{ sessions: number; tokens: number }> {
    const [sessions, tokens] = await Promise.all([
      this.sessions.deleteExpired(now),
      this.resetTokens.deleteExpired(now),
    ]);
    return { sessions, tokens };
  }
}
