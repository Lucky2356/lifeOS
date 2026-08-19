const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

/**
 * Русское склонение по числу: plural(1, 'объект', 'объекта', 'объектов') → «объект».
 * Intl.PluralRules даёт категорию (one/few/many), а формы всё равно нужны свои.
 */
const pluralRules = new Intl.PluralRules('ru-RU');

export function plural(n: number, one: string, few: string, many: string): string {
  const category = pluralRules.select(n);
  return category === 'one' ? one : category === 'few' ? few : many;
}

/** Число вместе со склонённым словом: «1 объект», «5 объектов». */
export function counted(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
