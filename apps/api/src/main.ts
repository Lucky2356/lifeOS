import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import { logger } from './common/logger';

async function bootstrap(): Promise<void> {
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
