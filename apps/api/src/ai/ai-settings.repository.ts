import { Injectable } from '@nestjs/common';
import { defaultAiSettings, type AiSettings } from '@life-os/domain';

/** Хранилище настроек ИИ по пользователю (in-memory; swap-in на Drizzle — как в других модулях). */
@Injectable()
export class AiSettingsRepository {
  private readonly store = new Map<string, AiSettings>();

  async get(userId: string): Promise<AiSettings> {
    return this.store.get(userId) ?? defaultAiSettings;
  }

  async save(userId: string, settings: AiSettings): Promise<AiSettings> {
    this.store.set(userId, settings);
    return settings;
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}
