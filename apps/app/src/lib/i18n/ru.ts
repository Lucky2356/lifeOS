import type { PluralForms } from './plural';

export const ru = {
  'app.loading': 'Загрузка…',
  'app.update.available': 'Доступна новая версия {version}. Обновите приложение — данные сохранятся.',
  'navigator.progress': {
    one: '{done} из {n} шага',
    few: '{done} из {n} шагов',
    many: '{done} из {n} шагов',
  },
} as const satisfies Record<string, string | PluralForms<'ru'>>;
