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

  'theme.toggle': 'Переключить тему',

  'navigator.title': 'Навигатор',
  'navigator.subtitle': 'Плейбуки трудных ситуаций и бюрократические гиды',
  'navigator.crisis': 'Кризисные ситуации',
  'navigator.bureaucracy': 'Бюрократия',
  'navigator.stepCount': {
    one: '{n} шаг',
    few: '{n} шага',
    many: '{n} шагов',
  },
  'navigator.openGuide': 'Открыть гид',
  'navigator.restart': 'Начать заново',
  'navigator.restartTitle': 'Начать «{playbook}» заново?',
  'navigator.restartMessage': 'Отметки по всем шагам будут сняты. Сам плейбук и его содержание не изменятся.',
  'navigator.stepDone': 'Отметить готовым',
  'navigator.stepUndone': 'Снять отметку',
  'navigator.docUnknown': 'Реестр не прочитан',
  'navigator.docOwned': 'Есть в реестре',
  'navigator.docMissing': 'В реестре не нашлось',
  'navigator.docOwnedSuffix': ' · есть',
  'navigator.docMissingSuffix': ' · нужно оформить',
  'navigator.progressFailed': 'Не удалось прочитать сохранённый прогресс.',
  'navigator.openFailed': 'Не удалось открыть плейбук.',
  'navigator.toggleFailed': 'Не удалось сохранить отметку — попробуйте ещё раз.',
  'navigator.restartFailed': 'Не удалось начать заново.',

  'navigator.progress': {
    one: '{done} из {n} шага',
    few: '{done} из {n} шагов',
    many: '{done} из {n} шагов',
  },
} as const satisfies Record<string, string | PluralForms<'ru'>>;
