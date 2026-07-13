import { useEffect } from 'react';

/** Закрытие модалки по Escape (клавиатурная доступность). Слушатель снимается при размонтировании. */
export function useEscapeToClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}
