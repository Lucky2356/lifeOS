import { startProgress, toggleStep, type Playbook, type PlaybookProgress } from '@life-os/domain';
import bundledPack from '@content-pack-ru';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Crisis Navigator. Контент-пак РФ вшит в сборку (ADR 0004) — плейбуки доступны всегда и
 * не требуют сети; прогресс пользователя лежит в IndexedDB.
 */

const playbooks: Playbook[] = bundledPack.playbooks;
const packMeta = { packId: bundledPack.packId, version: bundledPack.version };

export const navigatorStore = {
  playbooks(kind?: 'crisis' | 'bureaucracy'): Playbook[] {
    return kind ? playbooks.filter((p) => p.kind === kind) : playbooks;
  },

  playbook(key: string): Playbook {
    const found = playbooks.find((p) => p.key === key);
    if (!found) throw new Error(`Плейбук «${key}» отсутствует в контент-паке`);
    return found;
  },

  async progress(): Promise<PlaybookProgress[]> {
    return (await db()).getAll('progress');
  },

  /** Начать плейбук либо вернуть уже начатый (один прогресс на плейбук). */
  async start(key: string): Promise<PlaybookProgress> {
    const database = await db();
    const existing = (await database.getAll('progress')).find((p) => p.playbookKey === key);
    if (existing) return existing;
    const progress = startProgress(navigatorStore.playbook(key), packMeta, await ownerUserId());
    await database.put('progress', progress);
    return progress;
  },

  async toggleStep(progressId: string, stepKey: string): Promise<PlaybookProgress> {
    const database = await db();
    const current = await database.get('progress', progressId);
    if (!current) throw new Error('Прогресс не найден');
    const updated = toggleStep(current, stepKey);
    await database.put('progress', updated);
    return updated;
  },
};
