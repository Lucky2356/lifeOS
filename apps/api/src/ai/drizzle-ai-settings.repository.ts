import { eq } from 'drizzle-orm';
import { defaultAiSettings, type AiSettings } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { aiSettings } from '../db/schema';
import type { AiSettingsRepository } from './ai-settings.repository';

type Row = typeof aiSettings.$inferSelect;

function toSettings(row: Row): AiSettings {
  return {
    globalEnabled: row.globalEnabled,
    perModule: row.perModule as Record<string, boolean>,
    provider: row.provider as AiSettings['provider'],
    shareSensitive: row.shareSensitive,
  };
}

export class DrizzleAiSettingsRepository implements AiSettingsRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<AiSettings> {
    const rows = await this.db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1);
    return rows[0] ? toSettings(rows[0]) : defaultAiSettings;
  }

  async save(userId: string, settings: AiSettings): Promise<AiSettings> {
    const values = { userId, ...settings };
    await this.db
      .insert(aiSettings)
      .values(values)
      .onConflictDoUpdate({ target: aiSettings.userId, set: settings });
    return settings;
  }

  async delete(userId: string): Promise<void> {
    await this.db.delete(aiSettings).where(eq(aiSettings.userId, userId));
  }
}
