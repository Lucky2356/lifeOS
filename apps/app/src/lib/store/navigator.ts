import {
  reconcileProgress,
  startProgress,
  toggleStep,
  type Playbook,
  type PlaybookProgress,
} from '@life-os/domain';
import bundledPack from '@content-pack-ru';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Crisis Navigator. Контент-пак РФ вшит в сборку (ADR 0004) — плейбуки доступны всегда и
 * не требуют сети; прогресс пользователя лежит в IndexedDB.
 *
 * Пак приезжает вместе с релизом приложения, поэтому сохранённый прогресс может относиться к
 * прежнему набору шагов. Каждая запись согласуется с актуальным плейбуком на выходе отсюда:
 * выше по стеку никто не должен помнить, что контент вообще меняется.
 */

const playbooks: Playbook[] = bundledPack.playbooks;
const packMeta = { packId: bundledPack.packId, version: bundledPack.version };

function findPlaybook(key: string): Playbook | undefined {
  return playbooks.find((p) => p.key === key);
}

export const navigatorStore = {
  playbooks(kind?: 'crisis' | 'bureaucracy'): Playbook[] {
    return kind ? playbooks.filter((p) => p.kind === kind) : playbooks;
  },

  playbook(key: string): Playbook {
    const found = findPlaybook(key);
    if (!found) throw new Error(`Плейбук «${key}» отсутствует в контент-паке`);
    return found;
  },

  /**
   * Прогресс по всем начатым плейбукам, согласованный с текущим паком. Запись плейбука, которого
   * в паке больше нет, из выдачи исключается, но из базы не удаляется: контент может вернуться в
   * следующем релизе, а молча стирать отметки пользователя нельзя.
   */
  async progress(): Promise<PlaybookProgress[]> {
    const all = await (await db()).getAll('progress');
    return all.flatMap((p) => {
      const playbook = findPlaybook(p.playbookKey);
      return playbook ? [reconcileProgress(p, playbook, packMeta)] : [];
    });
  },

  /** Начать плейбук либо вернуть уже начатый (один прогресс на плейбук). */
  async start(key: string): Promise<PlaybookProgress> {
    const database = await db();
    const playbook = navigatorStore.playbook(key);
    const existing = (await database.getAll('progress')).find((p) => p.playbookKey === key);
    const progress = existing
      ? reconcileProgress(existing, playbook, packMeta)
      : startProgress(playbook, packMeta, await ownerUserId());
    await database.put('progress', progress);
    return progress;
  },

  async toggleStep(progressId: string, stepKey: string): Promise<PlaybookProgress> {
    const database = await db();
    const current = await database.get('progress', progressId);
    if (!current) throw new Error('Прогресс не найден');
    // Согласование до переключения: иначе ключи прежней версии плейбука вернулись бы в запись.
    const playbook = navigatorStore.playbook(current.playbookKey);
    const updated = toggleStep(reconcileProgress(current, playbook, packMeta), stepKey);
    await database.put('progress', updated);
    return updated;
  },

  /** Забыть прогресс по плейбуку — «начать заново». */
  async reset(playbookKey: string): Promise<void> {
    const database = await db();
    const existing = (await database.getAll('progress')).filter((p) => p.playbookKey === playbookKey);
    await Promise.all(existing.map((p) => database.delete('progress', p.id)));
  },
};
