import 'reflect-metadata';
import 'dotenv/config';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { logger } from './common/logger';

/**
 * Автоматически применяет миграции при старте, если задан DATABASE_URL. Идемпотентно (Drizzle
 * помнит применённые). Без этого таблиц не существует и запись данных молча не сохраняется.
 */
async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    logger.info('Миграции применены при старте');
  } finally {
    await client.end();
  }
}

async function bootstrap(): Promise<void> {
  await runMigrations();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });

  // Структурные логи запросов без тел и без PII (только метод/путь/статус).
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.info({ port }, 'Life OS API запущен');
}

void bootstrap();
