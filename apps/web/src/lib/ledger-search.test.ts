import { describe, it, expect } from 'vitest';
import type { LifeObject } from '@life-os/domain';
import { matchesQuery } from './ledger-search';

const obj = (title: string, data: Record<string, unknown> = {}): LifeObject =>
  ({ title, data }) as unknown as LifeObject;

describe('matchesQuery — поиск по реестру', () => {
  it('пустой запрос совпадает со всем', () => {
    expect(matchesQuery(obj('Загранпаспорт'), '')).toBe(true);
    expect(matchesQuery(obj('Загранпаспорт'), '   ')).toBe(true);
  });

  it('находит по названию, регистр не важен', () => {
    expect(matchesQuery(obj('Загранпаспорт'), 'загран')).toBe(true);
    expect(matchesQuery(obj('Загранпаспорт'), 'ЗАГРАН')).toBe(true);
    expect(matchesQuery(obj('Загранпаспорт'), 'осаго')).toBe(false);
  });

  it('находит по строковым значениям полей data', () => {
    const o = obj('Полис', { number: 'ААА-12345', company: 'Ингосстрах' });
    expect(matchesQuery(o, '12345')).toBe(true);
    expect(matchesQuery(o, 'ингосстрах')).toBe(true);
  });

  it('нестроковые значения полей не ломают поиск', () => {
    const o = obj('Подписка', { price: 599, active: true });
    expect(matchesQuery(o, 'подписка')).toBe(true);
    expect(matchesQuery(o, '599')).toBe(false); // числовые значения не индексируются
  });
});
