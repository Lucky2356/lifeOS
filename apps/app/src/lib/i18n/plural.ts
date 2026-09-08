import type { Locale } from '@life-os/domain';

/**
 * Категории множественного числа, достижимые при счёте целыми.
 *
 * Интерфейс считает записи, шаги и файлы, а не доли. Проверено перебором 0…2000: русскому хватает
 * `one`/`few`/`many`, английскому — `one`/`other`. Четвёртая категория русского, `other`, отвечает
 * за дробные («1,5 шага») и в счёте записей недостижима; требовать её от словаря значило бы
 * дословно повторять `many` в каждом сообщении.
 *
 * Чтобы недостижимость была фактом, а не надеждой, `pluralCategory` отбрасывает дробную часть.
 * Совпадение таблицы с ICU сверяет тест: разойдись она с рантаймом — и `t` искала бы форму,
 * которой в сообщении нет.
 */
export const pluralCategories = {
  ru: ['one', 'few', 'many'],
  en: ['one', 'other'],
} as const satisfies Record<Locale, readonly Intl.LDMLPluralRule[]>;

export type PluralCategory<L extends Locale> = (typeof pluralCategories)[L][number];

/** Формы одного сообщения на языке L: ровно его категории, все обязательны. */
export type PluralForms<L extends Locale> = { readonly [C in PluralCategory<L>]: string };

const rules = new Map<Locale, Intl.PluralRules>();

export function pluralCategory<L extends Locale>(locale: L, n: number): PluralCategory<L> {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    rules.set(locale, rule);
  }
  // Приведение безопасно ровно потому, что число целое, а таблица сверена с ICU тестом.
  return rule.select(Math.trunc(n)) as PluralCategory<L>;
}
