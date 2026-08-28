/**
 * Кнопка «Назад» — общая для трёх сред.
 *
 * Маршрут приложения живёт в состоянии React, а не в адресной строке, поэтому у истории браузера
 * нечего откручивать назад. На Android это стоило дорого: в ядре Capacitor 6 собственного
 * обработчика back нет, и аппаратная кнопка работала как у обычной Activity — **закрывала
 * приложение** с любого экрана и из любой открытой модалки. Открыл документ, нажал «назад» —
 * вышел из приложения вместе с незаполненной формой.
 *
 * Источник правды — свой стек шагов, а не история WebView. Каждый шаг вглубь (раздел, карточка
 * объекта, модалка) кладёт в него обработчик возврата; аппаратная кнопка Android спрашивает
 * напрямую этот стек, и только когда он пуст — закрывает приложение.
 *
 * История браузера нужна ровно для одного: поймать «назад» там, где кнопка не наша, — в браузере
 * при разработке. Для этого держится одна «ловушка»: запись в истории, живущая, пока в стеке есть
 * шаги. В упакованных сборках она ни на что не влияет — у окна Tauri своей кнопки «назад» нет
 * вовсе, а на Android решает стек.
 */

type BackHandler = { id: number; onBack: () => void };

const handlers: BackHandler[] = [];
let nextId = 1;
let listening = false;

/** Есть ли куда возвращаться внутри приложения. */
export function canGoBack(): boolean {
  return handlers.length > 0;
}

/** Снять верхний шаг и выполнить возврат. `false` — возвращаться некуда, это верхний экран. */
export function goBack(): boolean {
  const top = handlers.pop();
  if (!top) return false;
  top.onBack();
  return true;
}

function armTrap(): void {
  if (typeof history !== 'undefined') history.pushState({ losTrap: true }, '');
}

function onPopState(): void {
  if (handlers.length === 0) return;
  goBack();
  // Пока шаги остались, ловушка нужна снова: следующий «назад» тоже должен попасть к нам.
  if (handlers.length > 0) armTrap();
}

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', onPopState);
}

/**
 * Зарегистрировать шаг вглубь. Возвращает `release()` — вызвать, когда шаг закрыт изнутри
 * интерфейса (кнопкой «Отмена», сменой раздела), а не кнопкой «Назад».
 */
export function pushBackStop(onBack: () => void): () => void {
  listen();
  const entry: BackHandler = { id: nextId++, onBack };
  const wasEmpty = handlers.length === 0;
  handlers.push(entry);
  if (wasEmpty) armTrap();

  return () => {
    const index = handlers.findIndex((h) => h.id === entry.id);
    // Шаг уже сняли кнопкой «Назад» — делать нечего.
    if (index === -1) return;
    handlers.splice(index, 1);
    // Историю не трогаем намеренно: `history.back()` асинхронен, и попытка «подчистить» запись
    // съедала бы следующее нажатие «Назад». Лишняя запись безобидна, съеденное нажатие — нет.
  };
}

function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  );
}

/**
 * Аппаратная кнопка Android. Пока внутри приложения есть куда вернуться — возвращаемся;
 * на верхнем экране кнопка закрывает приложение, как и ожидает система.
 */
export async function initHardwareBack(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      if (!goBack()) void App.exitApp();
    });
  } catch {
    // Плагина нет — остаётся поведение по умолчанию, данные это не затрагивает.
  }
}

/** Только для тестов: сбросить состояние между случаями. */
export function resetBackStops(): void {
  handlers.length = 0;
}
