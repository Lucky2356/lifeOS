import { integer, jsonb, pgTable, text, uuid, index } from 'drizzle-orm/pg-core';

/**
 * Таблица объектов жизни (Life Ledger). Timestamps/hlc хранятся как ISO-текст —
 * ровно то, что несёт доменная модель (единый источник правды, без tz-дрейфа при sync).
 */
export const lifeObjects = pgTable(
  'life_objects',
  {
    id: uuid('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    hlc: text('hlc').notNull(),
    version: integer('version').notNull(),
    deletedAt: text('deleted_at'),
    ownerUserId: uuid('owner_user_id').notNull(),
    householdId: uuid('household_id'),
    type: text('type').notNull(),
    title: text('title').notNull(),
    data: jsonb('data').notNull(),
    status: text('status').notNull(),
    sensitivity: text('sensitivity').notNull(),
    validFrom: text('valid_from'),
    validUntil: text('valid_until'),
  },
  (t) => [index('life_objects_owner_idx').on(t.ownerUserId)],
);
