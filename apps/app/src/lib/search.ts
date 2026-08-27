import { objectTypeLabels, pickText, type Playbook } from '@life-os/domain';
import { matchesQuery } from './ledger-search';
import { decisionsStore } from './store/decisions';
import { householdStore } from './store/household';
import { navigatorStore } from './store/navigator';
import { ledgerStore } from './store/objects';

/**
 * Поиск по всему приложению. Раньше искать можно было только внутри реестра, хотя человек не держит
 * в голове, где именно лежит нужное: «ОСАГО» — это и объект, и задача по дому, и шаг плейбука.
 */

export type SearchKind = 'object' | 'task' | 'decision' | 'playbook';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** Что это и где лежит — строка под названием. */
  subtitle: string;
}

export const searchKindLabels: Record<SearchKind, string> = {
  object: 'Реестр',
  task: 'Дом',
  decision: 'Решения',
  playbook: 'Навигатор',
};

const contains = (haystack: string, needle: string) => haystack.toLocaleLowerCase('ru').includes(needle);

function playbookMatches(playbook: Playbook, needle: string): boolean {
  if (contains(pickText(playbook.title, 'ru'), needle)) return true;
  if (contains(pickText(playbook.summary, 'ru'), needle)) return true;
  return playbook.steps.some((s) => contains(pickText(s.title, 'ru'), needle));
}

/** Ищет по реестру, задачам дома, решениям и плейбукам. Пустой запрос — пустой результат. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (needle.length === 0) return [];

  const [objects, decisions, household] = await Promise.all([
    ledgerStore.list(),
    decisionsStore.list(),
    householdStore.current(),
  ]);
  const tasks = household ? await householdStore.tasks(household.id) : [];

  const hits: SearchHit[] = [];

  for (const o of objects) {
    if (!matchesQuery(o, query)) continue;
    hits.push({
      kind: 'object',
      id: o.id,
      title: o.title,
      subtitle: objectTypeLabels[o.type].ru + (o.status === 'archived' ? ' · в архиве' : ''),
    });
  }

  for (const t of tasks) {
    if (!contains(t.title, needle)) continue;
    hits.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      subtitle: t.status === 'done' ? 'задача · выполнена' : 'задача по дому',
    });
  }

  for (const d of decisions) {
    if (!contains(d.title, needle) && !contains(d.context, needle)) continue;
    hits.push({
      kind: 'decision',
      id: d.id,
      title: d.title,
      subtitle: d.status === 'decided' ? 'решение · принято' : 'решение · черновик',
    });
  }

  for (const p of navigatorStore.playbooks()) {
    if (!playbookMatches(p, needle)) continue;
    hits.push({
      kind: 'playbook',
      id: p.key,
      title: pickText(p.title, 'ru'),
      subtitle: p.kind === 'crisis' ? 'плейбук' : 'бюрократический гид',
    });
  }

  return hits;
}
