import { startProgress, toggleStep, type Playbook, type PlaybookProgress } from '@life-os/domain';
import bundledPack from '@content-pack-ru';
import { apiFetch, apiRequest } from './http';
import { currentUserId, enqueue, pendingPaths } from './offline-core';

// Пак РФ вшит в клиент — Навигатор работает офлайн и в локальном режиме без сервера.
const bundledPlaybooks: Playbook[] = bundledPack.playbooks;
const bundledMeta = { packId: bundledPack.packId, version: bundledPack.version };

/**
 * Offline-first слой Crisis Navigator (ADR 0003). Контент плейбуков кэшируется для чтения офлайн;
 * прогресс (start/toggle) — локально с доливом через upsert. Прогресс не имеет version — разрешение
 * конфликтов LWW по порядку долива, ключ на сервере (владелец, playbookKey).
 */

const CACHE_PB = 'los-playbooks-cache';
const CACHE_PROG = 'los-progress-cache';
const CACHE_PACK = 'los-packmeta-cache';

type PackMeta = { packId: string; version: string };

function readPlaybooks(): Playbook[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PB) ?? '[]') as Playbook[];
  } catch {
    return [];
  }
}
function readProgress(): PlaybookProgress[] {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PROG) ?? '[]') as PlaybookProgress[];
  } catch {
    return [];
  }
}
function writeProgress(list: PlaybookProgress[]) {
  localStorage.setItem(CACHE_PROG, JSON.stringify(list));
}
function putProgress(p: PlaybookProgress) {
  writeProgress([...readProgress().filter((x) => x.id !== p.id), p]);
  capturePackMeta(p);
}
function capturePackMeta(p: Pick<PlaybookProgress, 'packId' | 'packVersion'>) {
  localStorage.setItem(CACHE_PACK, JSON.stringify({ packId: p.packId, version: p.packVersion }));
}
function packMeta(): PackMeta {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PACK) ?? '') as PackMeta;
  } catch {
    // Первый старт без ранее виденного прогресса — метаданные из вшитого пака.
    return bundledMeta;
  }
}

export const offlineNavigator = {
  async playbooks(kind?: 'crisis' | 'bureaucracy'): Promise<Playbook[]> {
    let all: Playbook[];
    try {
      all = await apiFetch<Playbook[]>('/content/playbooks');
      localStorage.setItem(CACHE_PB, JSON.stringify(all));
    } catch {
      all = readPlaybooks();
    }
    // Нет сервера/кэша (офлайн или локальный режим) — берём вшитый пак.
    if (all.length === 0) all = bundledPlaybooks;
    return kind ? all.filter((p) => p.kind === kind) : all;
  },

  async playbook(key: string): Promise<Playbook> {
    try {
      return await apiFetch<Playbook>(`/content/playbooks/${key}`);
    } catch {
      const p = readPlaybooks().find((x) => x.key === key) ?? bundledPlaybooks.find((x) => x.key === key);
      if (!p) throw new Error('Плейбук недоступен офлайн');
      return p;
    }
  },

  async progress(): Promise<PlaybookProgress[]> {
    try {
      const server = await apiFetch<PlaybookProgress[]>('/content/progress');
      const pending = pendingPaths();
      const keep = readProgress().filter((p) => pending.has(`/content/progress/${p.id}`));
      const merged = [...keep, ...server.filter((s) => !keep.some((k) => k.id === s.id))];
      writeProgress(merged);
      if (merged[0]) capturePackMeta(merged[0]);
      return merged;
    } catch {
      return readProgress();
    }
  },

  async start(key: string): Promise<PlaybookProgress> {
    try {
      const p = await apiRequest(`/content/playbooks/${key}/start`, { method: 'POST' });
      if (p.ok) {
        const prog = (await p.json()) as PlaybookProgress;
        putProgress(prog);
        return prog;
      }
    } catch {
      /* офлайн — ниже */
    }
    // Офлайн: вернуть уже начатый прогресс либо создать локально.
    const existing = readProgress().find((x) => x.playbookKey === key);
    if (existing) return existing;
    const playbook = await offlineNavigator.playbook(key);
    const meta = packMeta();
    const prog = startProgress(playbook, { packId: meta.packId, version: meta.version }, currentUserId());
    putProgress(prog);
    enqueue({ path: `/content/progress/${prog.id}`, method: 'PUT', body: JSON.stringify(prog) });
    return prog;
  },

  async toggleStep(progressId: string, stepKey: string): Promise<PlaybookProgress> {
    const current = readProgress().find((x) => x.id === progressId);
    if (!current) throw new Error('Прогресс не найден в кэше');
    const updated = toggleStep(current, stepKey);
    putProgress(updated);
    enqueue({ path: `/content/progress/${updated.id}`, method: 'PUT', body: JSON.stringify(updated) });
    return updated;
  },
};
