import { getLocale, type Locale } from './i18n';

/**
 * Форматтеры строятся лениво и кэшируются по языку. Раньше это были модульные константы `ru-RU`,
 * созданные при импорте: на смену языка они не реагировали в принципе.
 *
 * Часы держим 24-часовыми в обоих языках. По умолчанию английский даёт «at 08:02 AM» —
 * переключение языка меняло бы вид времени, а не только его язык. Для русского `hourCycle` холостой.
 */
const dateOptions = {
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  dateTime: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  },
  weekday: { weekday: 'long', day: 'numeric', month: 'long' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

type DateShape = keyof typeof dateOptions;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: Locale, shape: DateShape): Intl.DateTimeFormat {
  const key = `${locale}:${shape}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, dateOptions[shape]);
    dateFormats.set(key, format);
  }
  return format;
}

function formatShape(iso: string | null | undefined, shape: DateShape): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormat(getLocale(), shape).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  return formatShape(iso, 'date');
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatShape(iso, 'dateTime');
}

/** Дата с днём недели — шапка «Сегодня». Раньше её форматтер строился инлайн на каждой отрисовке. */
export function formatWeekdayDate(date: Date): string {
  return dateFormat(getLocale(), 'weekday').format(date);
}

const collators = new Map<Locale, Intl.Collator>();

/**
 * Сравнение отображаемых строк по правилам языка. Прежний код звал `.localeCompare` без аргумента,
 * то есть сортировал по локали хоста, а не по своей.
 */
export function compareText(a: string, b: string): number {
  const locale = getLocale();
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale);
    collators.set(locale, collator);
  }
  return collator.compare(a, b);
}

/**
 * Русское склонение по числу: plural(1, 'объект', 'объекта', 'объектов') → «объект».
 *
 * Только для русского и только до конца перевода интерфейса: падеж здесь выбирает место вызова, а
 * не сообщение, и в английском это не выражается. Каждый вызов по мере перевода экрана заменяется
 * ключом с формами в словаре, после чего обе функции уезжают.
 */
const pluralRules = new Intl.PluralRules('ru-RU');

export function plural(n: number, one: string, few: string, many: string): string {
  const category = pluralRules.select(n);
  if (category === 'one') return one;
  return category === 'few' ? few : many;
}

/** Число вместе со склонённым словом: «1 объект», «5 объектов». */
export function counted(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
