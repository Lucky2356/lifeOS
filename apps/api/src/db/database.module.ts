import { Global, Module } from '@nestjs/common';
import { DRIZZLE, drizzleProvider } from './drizzle.provider';

/** Глобальный доступ к подключению БД. Если DATABASE_URL нет — DRIZZLE = null (модули падают на in-memory). */
@Global()
@Module({
  providers: [drizzleProvider],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
