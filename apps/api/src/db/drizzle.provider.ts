import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Провайдер подключения к БД. Если DATABASE_URL не задан — возвращает null,
 * и модуль Ledger падает обратно на in-memory (zero-config локальная разработка).
 */
export const drizzleProvider = {
  provide: DRIZZLE,
  useFactory: (): Database | null => {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    const client = postgres(url);
    return drizzle(client, { schema });
  },
};
