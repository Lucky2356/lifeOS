import type { LifeObject } from '@life-os/domain';

/**
 * Совпадает ли объект реестра с поисковым запросом. Ищем по названию и по строковым значениям полей
 * (`data`). Пустой запрос совпадает со всем. Регистр не учитывается.
 */
export function matchesQuery(o: LifeObject, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [o.title, ...Object.values(o.data).filter((v): v is string => typeof v === 'string')]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
