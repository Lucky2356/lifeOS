import { useMemo, useSyncExternalStore } from 'react';
import type { Locale } from '@life-os/domain';
import type { TFunction } from './dict';
import { translate } from './t';
import { getLocale, setLocale, subscribe } from './store';

/**
 * Язык как внешнее хранилище, а не контекст.
 *
 * `t()` читает модульную переменную, о которой React ничего не знает: контекст перерисовал бы
 * только своих потребителей, а `t()` зовут не они. Сейчас это сходило бы с рук лишь потому, что в
 * приложении нет ни одного `React.memo`, — и уже не сходит там, где результат перевода закэширован
 * в `useMemo` или лежит в состоянии.
 *
 * Поэтому `useT()` отдаёт новую функцию на каждый язык: невидимая глобальная зависимость
 * превращается в обычную зависимость, которую можно выписать в `useMemo`.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

export function useT(): TFunction {
  const locale = useLocale();
  return useMemo(() => translate(locale), [locale]);
}

export function useLocaleSetting(): { locale: Locale; setLocale: (next: Locale) => void } {
  return { locale: useLocale(), setLocale };
}
