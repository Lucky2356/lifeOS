import type { Locale } from '@life-os/domain';

/**
 * Выбранный язык интерфейса.
 *
 * Живёт в localStorage, а не в хранилище настроек IndexedDB, по той же причине, что и тема:
 * `getSetting` асинхронна, а язык нужен до первой отрисовки. Читать его умеют и модули вне React —
 * уведомления, поиск, сообщения об ошибках, — поэтому состояние модульное, а React подписывается
 * на него через `useSyncExternalStore`.
 *
 * Значений два: русский и английский. «Как в системе» здесь нет намеренно — в отличие от темы,
 * у языка нет ни `matchMedia`, ни события смены, а `navigator.language` вполне может оказаться
 * третьим языком, которого у нас нет. По умолчанию русский.
 */

const KEY = 'los-locale';

function stored(): Locale {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ru';
  } catch {
    // В приватном режиме и при запрещённом хранилище доступ бросает. Язык — не повод падать.
    return 'ru';
  }
}

let locale: Locale = stored();
const listeners = new Set<() => void>();

/** Снимок для useSyncExternalStore: примитив, поэтому лишних перерисовок не будет. */
export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Не сохранилось — язык всё равно сменится до конца сеанса.
  }
  applyLang();
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Язык документа: его читают вспомогательные технологии и переносы слов. Ставится здесь, а не
 * эффектом, — эффект отработал бы после первой отрисовки, и в разметке `index.html` осталось бы
 * зашитое `lang="ru"`.
 */
function applyLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
applyLang();

/** Вернуть язык к умолчанию. Тесты в одном файле делят localStorage — без сброса они текут. */
export function resetLocaleForTests(): void {
  locale = 'ru';
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* хранилище недоступно — сбрасывать нечего */
  }
  applyLang();
}
