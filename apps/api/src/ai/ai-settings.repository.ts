import { Injectable } from '@nestjs/common';
import { defaultAiSettings, type AiSettings } from '@life-os/domain';

export interface AiSettingsRepository {
  get(userId: string): Promise<AiSettings>;
  save(userId: string, settings: AiSettings): Promise<AiSettings>;
  delete(userId: string): Promise<void>;
}

export const AI_SETTINGS_REPOSITORY = Symbol('AI_SETTINGS_REPOSITORY');

/** Хранилище настроек ИИ по пользователю (in-memory). */
@Injectable()
export class InMemoryAiSettingsRepository implements AiSettingsRepository {
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
