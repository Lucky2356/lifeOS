import type { Locale } from '@life-os/domain';
import { pluralCategory } from './plural';
import type { Dict, MessageKey, Params, TFunction } from './dict';
import { ru } from './ru';
import { en } from './en';
import { getLocale } from './store';

const dicts: { [L in Locale]: Dict<L> } = { ru, en };

/** Подстановка `{имя}`. Синтаксис — подмножество ICU, чтобы переезд на библиотеку остался механическим. */
function fill(template: string, params: Params | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

function lookup(locale: Locale, key: MessageKey, params?: Params): string {
  const message = dicts[locale][key];
  if (typeof message === 'string') return fill(message, params);
  // Ключ с формами: счётчик обязателен по типу TFunction, поэтому здесь он есть.
  // Приведение категории безопасно, пока таблица категорий совпадает с ICU, — это сверяет тест.
  const category = pluralCategory(locale, Number(params?.n)) as keyof typeof message;
  return fill(message[category], params);
}

/** Перевод на явно указанном языке: нужен тестам и всему, что не должно зависеть от текущего выбора. */
export function translate(locale: Locale): TFunction {
  return ((key: MessageKey, params?: Params) => lookup(locale, key, params)) as TFunction;
}

/** Перевод на текущем языке. Для модулей вне React: уведомлений, поиска, сообщений об ошибках. */
export const t: TFunction = ((key: MessageKey, params?: Params) =>
  lookup(getLocale(), key, params)) as TFunction;
