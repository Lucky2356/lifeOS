import 'reflect-metadata';
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import pinoHttp from 'pino-http';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { logger } from './common/logger';

const INSECURE_DEFAULTS = new Set([
  '',
  'dev-insecure-jwt-secret',
  'dev-insecure-key-change-me',
  'change-me-please-a-long-random-jwt-secret',
  'change-me-please-a-long-random-encryption-key',
]);

function isWeak(v: string | undefined): boolean {
  return !v || v.length < 16 || INSECURE_DEFAULTS.has(v) || v.startsWith('change-me');
}

/**
 * Гарантирует надёжные секреты (JWT/шифрование) ДО загрузки Nest-модулей. Если в окружении не задан
 * стойкий секрет, берём/создаём случайный, привязанный к этой установке, в таблице app_secrets —
 * так каждый инсталл уникален и не зависит от публичного дефолта из исходников. Выполняется до
 * NestFactory.create, поэтому JwtModule и crypto подхватывают значения из process.env.
 */
async function ensureSecrets(): Promise<void> {
  const needed: Array<'JWT_SECRET' | 'ENCRYPTION_KEY'> = [];
  if (isWeak(process.env.JWT_SECRET)) needed.push('JWT_SECRET');
  if (isWeak(process.env.ENCRYPTION_KEY)) needed.push('ENCRYPTION_KEY');
  if (needed.length === 0) return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Без БД (локальная разработка in-memory) — эфемерные случайные секреты на время процесса.
    for (const k of needed) process.env[k] = randomBytes(32).toString('hex');
    logger.warn('Секреты не заданы и нет БД — сгенерированы временные (только для локального dev)');
    return;
  }

  const client = postgres(url, { max: 1 });
  try {
    await client`create table if not exists app_secrets (key text primary key, value text not null)`;
    for (const k of needed) {
      const rows = await client`select value from app_secrets where key = ${k}`;
      let value = rows[0]?.value as string | undefined;
      if (!value) {
        value = randomBytes(32).toString('hex');
        await client`insert into app_secrets (key, value) values (${k}, ${value})
          on conflict (key) do nothing`;
        const again = await client`select value from app_secrets where key = ${k}`;
        value = (again[0]?.value as string) ?? value;
      }
      process.env[k] = value;
    }
    logger.info('Секреты установки загружены/сгенерированы (app_secrets)');
  } finally {
    await client.end();
  }
}

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
  await ensureSecrets();
  // ВАЖНО: граф модулей грузим динамически ТОЛЬКО после ensureSecrets(). Статический импорт наверху
  // вычислял бы JwtModule.register и crypto.ts (ключ на уровне модуля) раньше, чем секреты попадут в
  // process.env — тогда per-install секреты из app_secrets игнорировались бы (см. фикс безопасности).
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule);
  // Security-заголовки на API. CSP отключаем — API отдаёт только JSON (CSP задаётся на edge/Caddy для
  // веба); остальные защиты helmet (nosniff, frameguard, hidePoweredBy, referrer-policy и т.п.) полезны.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  // CORS. Аутентификация на Bearer-токенах (не cookie), поэтому по умолчанию origin отражается —
  // так работают веб и нативные оболочки (tauri/capacitor). Для ужесточения задайте ALLOWED_ORIGINS
  // (список через запятую) — тогда пускаем только их плюс схемы нативных приложений.
  const nativeOrigins = [
    'tauri://localhost',
    'https://tauri.localhost',
    'capacitor://localhost',
    'http://localhost',
    'https://localhost',
  ];
  const configured = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors(
    configured.length > 0
      ? { origin: [...configured, ...nativeOrigins], credentials: true }
      : { origin: true, credentials: true },
  );

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
