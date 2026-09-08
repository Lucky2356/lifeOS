import type { PluralForms } from './plural';

export const ru = {
  'app.loading': 'Загрузка…',
  'app.update.available': 'Доступна новая версия {version}. Обновите приложение — данные сохранятся.',
  'app.update.action': 'Обновить',
  'app.update.later': 'Позже',

  'nav.aria': 'Основная навигация',
  'nav.today': 'Сегодня',
  'nav.ledger': 'Реестр',
  'nav.household': 'Дом',
  'nav.decisions': 'Решения',
  'nav.navigator': 'Навигатор',
  'nav.search': 'Поиск',
  'nav.settings': 'Настройки',

  'navigator.progress': {
    one: '{done} из {n} шага',
    few: '{done} из {n} шагов',
    many: '{done} из {n} шагов',
  },
} as const satisfies Record<string, string | PluralForms<'ru'>>;
