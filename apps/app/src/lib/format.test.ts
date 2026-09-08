import { describe, expect, it } from 'vitest';
import { compareText, counted, formatDate, formatDateTime, formatWeekdayDate } from './format';
import { setLocale } from './i18n';

const moment = '2026-09-08T08:02:00.000Z';

describe('форматирование дат', () => {
  it('следует за выбранным языком', () => {
    expect(formatDate(moment)).toBe('8 сентября 2026 г.');

    setLocale('en');
    expect(formatDate(moment)).toBe('September 8, 2026');
  });

  it('держит 24-часовые часы в обоих языках', () => {
    // По умолчанию английский дал бы «at 08:02 AM»: переключение языка меняло бы вид времени,
    // а не только его язык.
    expect(formatDateTime(moment)).toContain('08:02');

    setLocale('en');
    const formatted = formatDateTime(moment);
    expect(formatted).toContain('08:02');
    expect(formatted).not.toMatch(/AM|PM/);
  });

  it('пустую дату показывает прочерком, а не словом Invalid Date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('не дата')).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('день недели тоже переводится', () => {
    expect(formatWeekdayDate(new Date(moment))).toContain('сентября');

    setLocale('en');
    expect(formatWeekdayDate(new Date(moment))).toContain('September');
  });
});

describe('сравнение строк', () => {
  it('сортирует по правилам языка, а не по кодам символов', () => {
    // «ё» в алфавите стоит сразу после «е», а её код — далеко за «я»: по кодам 'ёж' > 'ель'.
    // Прежний localeCompare без указания языка сортировал по локали хоста, то есть как повезёт.
    expect(compareText('ёж', 'ель')).toBeLessThan(0);
    expect(compareText('ёж', 'жук')).toBeLessThan(0);
  });
});

describe('счёт по-русски', () => {
  it('склоняет слово по числу', () => {
    expect(counted(1, 'объект', 'объекта', 'объектов')).toBe('1 объект');
    expect(counted(3, 'объект', 'объекта', 'объектов')).toBe('3 объекта');
    expect(counted(11, 'объект', 'объекта', 'объектов')).toBe('11 объектов');
  });
});
