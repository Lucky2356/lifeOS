import { describe, expect, it } from 'vitest';
import type { Locale } from '@life-os/domain';
import { pluralCategories, pluralCategory } from './plural';
import { getLocale, setLocale } from './store';
import { t, translate } from './t';
import { ru } from './ru';
import { en } from './en';

const locales: Locale[] = ['ru', 'en'];
const LOADING = 'app.loading';

describe('множественное число', () => {
  it.each(locales)('таблица категорий %s — ровно то, что ICU даёт на целых числах', (locale) => {
    // Таблица задаёт формы, которые обязан заполнить словарь. Разойдись она с рантаймом — и `t`
    // искала бы форму, которой в сообщении нет. Сверяем перебором, а не списком из ICU: у русского
    // в ICU есть четвёртая категория, other, но она отвечает за дробные и в счёте недостижима.
    const rules = new Intl.PluralRules(locale);
    const reachable = new Set<string>();
    for (let n = 0; n <= 2000; n += 1) reachable.add(rules.select(n));

    expect([...pluralCategories[locale]].sort()).toEqual([...reachable].sort());
  });

  it.each(locales)('дробное число не выпадает за таблицу %s', (locale) => {
    // На дробях ICU вернул бы other, которого в русском словаре нет: pluralCategory отбрасывает
    // дробную часть, поэтому поиск формы остаётся полным.
    expect(pluralCategories[locale]).toContain(pluralCategory(locale, 1.5));
  });

  it('русский выбирает форму по числу, а не по «одно или много»', () => {
    const step = (n: number) => t('navigator.progress', { done: 1, n });

    expect(step(1)).toBe('1 из 1 шага');
    expect(step(2)).toBe('1 из 2 шагов');
    expect(step(5)).toBe('1 из 5 шагов');
    expect(step(21)).toBe('1 из 21 шага');
    expect(step(0)).toBe('1 из 0 шагов');
  });

  it('английский обходится двумя формами', () => {
    const step = (n: number) => translate('en')('navigator.progress', { done: 1, n });

    expect(step(1)).toBe('1 of 1 step');
    expect(step(2)).toBe('1 of 2 steps');
    expect(step(21)).toBe('1 of 21 steps');
  });
});

describe('подстановка', () => {
  it('подставляет значения по имени', () => {
    expect(t('app.update.available', { version: '1.6.0' })).toContain('1.6.0');
  });

  it('незнакомое имя остаётся как есть, а не превращается в undefined', () => {
    // Лучше показать человеку {version}, чем слово «undefined» посреди фразы.
    expect(t('app.update.available', {})).toContain('{version}');
  });
});

describe('выбор языка', () => {
  it('по умолчанию русский', () => {
    expect(getLocale()).toBe('ru');
    expect(t(LOADING)).toBe(ru[LOADING]);
  });

  it('переключение меняет и язык документа', () => {
    setLocale('en');

    expect(getLocale()).toBe('en');
    expect(t(LOADING)).toBe(en[LOADING]);
    expect(document.documentElement.lang).toBe('en');
  });

  it('translate не зависит от текущего выбора', () => {
    setLocale('en');

    expect(translate('ru')(LOADING)).toBe(ru[LOADING]);
  });
});
