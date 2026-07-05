import pino from 'pino';

/**
 * Структурированный логгер. Чувствительные заголовки удаляются (redact), тела запросов
 * не логируются вовсе — по требованию безопасности «без утечки PII в логи» (docs/SECURITY.md).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-dev-user"]',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
});
