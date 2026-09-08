import {
  objectTypeLabels,
  pickText,
  type Decision,
  type HouseholdTask,
  type LifeObject,
  type Locale,
  type LocalizedText,
  type Playbook,
} from '@life-os/domain';
import { matchesQuery } from './ledger-search';
import { getLocale, t } from './i18n';
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

/** Подписи разделов — ключи, а не готовые строки: сам SearchKind объявлен здесь, домен о нём не знает. */
export const searchKindLabels = {
  object: 'search.kindObject',
  task: 'search.kindTask',
  decision: 'search.kindDecision',
  playbook: 'search.kindPlaybook',
} as const satisfies Record<SearchKind, string>;

/**
 * Приведение к нижнему регистру делается по языку запроса — но обе стороны сравнения одинаково,
 * иначе поиск ломается на языках со своими правилами регистра.
 */
const fold = (s: string) => s.toLocaleLowerCase(getLocale());
const contains = (haystack: string, needle: string) => fold(haystack).includes(needle);

/**
 * Тексты пака ищутся на обоих языках, а показываются на текущем.
 *
 * Иначе в английском режиме русский запрос не нашёл бы в паке ничего — хотя русский текст лежит
 * в той же сборке, в том же объекте. Человек, который набирает «пособие», ищет своё, а не язык
 * интерфейса.
 */
function matchesBoth(text: LocalizedText, needle: string): boolean {
  return contains(text.ru, needle) || contains(text.en, needle);
}

function playbookMatches(playbook: Playbook, needle: string): boolean {
  if (matchesBoth(playbook.title, needle)) return true;
  if (matchesBoth(playbook.summary, needle)) return true;
  return playbook.steps.some((s) => matchesBoth(s.title, needle));
}

/**
 * Сборщики по разделам. Порознь, а не одним циклом с ветками: каждый знает про свой вид записи и
 * свою подпись, и добавление раздела не утяжеляет остальные.
 */
function objectHits(objects: LifeObject[], query: string, locale: Locale): SearchHit[] {
  return objects
    .filter((o) => matchesQuery(o, query))
    .map((o) => ({
      kind: 'object' as const,
      id: o.id,
      title: o.title,
      subtitle:
        objectTypeLabels[o.type][locale] + (o.status === 'archived' ? t('search.archivedSuffix') : ''),
    }));
}

function taskHits(tasks: HouseholdTask[], needle: string): SearchHit[] {
  return tasks
    .filter((task) => contains(task.title, needle))
    .map((task) => ({
      kind: 'task' as const,
      id: task.id,
      title: task.title,
      subtitle: task.status === 'done' ? t('search.taskDone') : t('search.taskOpen'),
    }));
}

function decisionHits(decisions: Decision[], needle: string): SearchHit[] {
  return decisions
    .filter((d) => contains(d.title, needle) || contains(d.context, needle))
    .map((d) => ({
      kind: 'decision' as const,
      id: d.id,
      title: d.title,
      subtitle: d.status === 'decided' ? t('search.decisionDecided') : t('search.decisionDraft'),
    }));
}

function playbookHits(needle: string, locale: Locale): SearchHit[] {
  return navigatorStore
    .playbooks()
    .filter((p) => playbookMatches(p, needle))
    .map((p) => ({
      kind: 'playbook' as const,
      id: p.key,
      title: pickText(p.title, locale),
      subtitle: p.kind === 'crisis' ? t('search.playbook') : t('search.guide'),
    }));
}

/** Ищет по реестру, задачам дома, решениям и плейбукам. Пустой запрос — пустой результат. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const needle = fold(query.trim());
  if (needle.length === 0) return [];

  const locale = getLocale();
  const [objects, decisions, household] = await Promise.all([
    ledgerStore.list(),
    decisionsStore.list(),
    householdStore.current(),
  ]);
  const tasks = household ? await householdStore.tasks(household.id) : [];

  return [
    ...objectHits(objects, query, locale),
    ...taskHits(tasks, needle),
    ...decisionHits(decisions, needle),
    ...playbookHits(needle, locale),
  ];
}
