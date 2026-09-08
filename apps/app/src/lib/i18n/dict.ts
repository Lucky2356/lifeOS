import type { Locale } from '@life-os/domain';
import type { PluralForms } from './plural';
import type { ru } from './ru';

/**
 * Русский словарь — единственный источник ключей. Английский выводится из него отображённым типом,
 * а не свободным `Record`: так ошибкой компиляции становится не только пропущенный ключ, но и
 * строка там, где нужны формы, формы там, где нужна строка, пропущенная категория и лишняя
 * категория, которой в языке нет. Недоперевод перестаёт быть находкой пользователя.
 */
export type MessageKey = keyof typeof ru;

export type Dict<L extends Locale> = {
  [K in MessageKey]: (typeof ru)[K] extends string ? string : PluralForms<L>;
};

/** Ключи, которым нужен счётчик, и ключи, которым он не нужен. */
export type PluralKey = { [K in MessageKey]: (typeof ru)[K] extends string ? never : K }[MessageKey];
export type PlainKey = { [K in MessageKey]: (typeof ru)[K] extends string ? K : never }[MessageKey];

export type Params = Readonly<Record<string, string | number>>;

/** Ключу с формами счётчик обязателен — иначе выбирать форму не по чему. */
export interface TFunction {
  (key: PluralKey, params: Params & { n: number }): string;
  (key: PlainKey, params?: Params): string;
}
