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

  'dialog.confirm': 'Подтвердить',
  'dialog.cancel': 'Отмена',
  'dialog.done': 'Готово',

  'error.title': 'Что-то пошло не так',
  'error.body':
    'Приложение не смогло прочитать данные на этом устройстве. Чаще всего помогает перезапуск. Ваши записи при этом не трогаются.',
  'error.restart': 'Перезапустить',
  'error.details': 'Подробности ошибки',

  'object.new': 'Новый объект',
  'object.title': 'Название',
  'object.titlePlaceholder': 'Загранпаспорт',
  'object.type': 'Тип',
  'object.validUntil': 'Действует до / дедлайн (необязательно)',
  'object.add': 'Добавить',
  'object.saving': 'Сохраняю…',
  'object.saveFailed': 'Не удалось сохранить',
  'object.sensitivity': 'Чувствительность',
  'object.sensitivityHint': 'Значения выше обычной скрыты в карточке, пока их не откроют.',

  'navigator.progress': {
    one: '{done} из {n} шага',
    few: '{done} из {n} шагов',
    many: '{done} из {n} шагов',
  },
} as const satisfies Record<string, string | PluralForms<'ru'>>;
