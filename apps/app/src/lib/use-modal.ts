import { useEffect, useRef } from 'react';
import { pushBackStop } from './history-nav';

/**
 * Закрытие модалки по Escape и по кнопке «Назад».
 *
 * «Назад» здесь не украшение: на Android аппаратная кнопка закрывала всё приложение вместе с
 * открытой формой, а закрыть диалог тем жестом, которым его закрывают в любом другом приложении,
 * было нельзя.
 *
 * Обработчик держим в ref: `onClose` почти всегда стрелка, создаваемая заново при каждом рендере
 * родителя, и без ref запись в истории пере-создавалась бы на каждое нажатие клавиши в соседнем
 * поле ввода.
 */
export function useEscapeToClose(onClose: () => void): void {
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('keydown', onKey);
    const release = pushBackStop(() => latest.current());
    return () => {
      document.removeEventListener('keydown', onKey);
      release();
    };
  }, []);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/**
 * Удерживает фокус внутри модалки и возвращает его на место при закрытии.
 * Без этого Tab уходит на элементы под оверлеем: для клавиатуры и скринридера диалог как бы
 * и не модальный, хотя `aria-modal` обещает обратное.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const previous = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      // Возврат фокуса на элемент, с которого диалог открыли, — иначе он уезжает в начало страницы.
      previous?.focus?.();
    };
  }, []);

  return ref;
}
