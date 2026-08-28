import { afterEach, describe, expect, it, vi } from 'vitest';
import { canGoBack, goBack, pushBackStop, resetBackStops } from './history-nav';

/**
 * «Назад» — единственная кнопка, которая раньше на Android закрывала всё приложение вместе с
 * открытой формой. Поведение стека проверяем без браузера: jsdom исполняет History API честно,
 * а popstate рассылаем руками, потому что сам он его не шлёт.
 */

function pressBack(): void {
  history.back();
  window.dispatchEvent(new PopStateEvent('popstate'));
}

afterEach(() => {
  resetBackStops();
});

describe('стек возврата', () => {
  it('возвращается по шагам в обратном порядке', () => {
    const screen = vi.fn();
    const modal = vi.fn();

    pushBackStop(screen);
    pushBackStop(modal);
    expect(canGoBack()).toBe(true);

    pressBack();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(screen).not.toHaveBeenCalled();

    pressBack();
    expect(screen).toHaveBeenCalledTimes(1);
    expect(canGoBack()).toBe(false);
  });

  it('шаг, закрытый изнутри, не срабатывает потом по «Назад»', () => {
    const screen = vi.fn();
    const modal = vi.fn();
    pushBackStop(screen);
    const closeModal = pushBackStop(modal);

    // Пользователь нажал «Отмена» в диалоге — обработчик снимается вместе с шагом.
    closeModal();
    expect(canGoBack()).toBe(true);

    pressBack();
    expect(modal).not.toHaveBeenCalled();
    expect(screen).toHaveBeenCalledTimes(1);
  });

  it('release после «Назад» ничего не ломает', () => {
    const modal = vi.fn();
    const release = pushBackStop(modal);

    pressBack();
    expect(modal).toHaveBeenCalledTimes(1);

    // Размонтирование модалки вызовет release уже после того, как её сняли кнопкой «Назад».
    release();
    pressBack();
    expect(modal).toHaveBeenCalledTimes(1);
  });

  it('повторный вход после закрытия изнутри снова ловит «Назад»', () => {
    const first = vi.fn();
    const second = vi.fn();

    pushBackStop(first)();
    pushBackStop(second);

    pressBack();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('двойной монтаж эффекта (StrictMode) не съедает нажатие', () => {
    const handler = vi.fn();
    // React в dev вызывает эффект, откатывает его и вызывает снова.
    const release = pushBackStop(handler);
    release();
    pushBackStop(handler);

    pressBack();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('на верхнем экране возвращаться некуда — это выход из приложения', () => {
    expect(canGoBack()).toBe(false);
    expect(goBack()).toBe(false);
    expect(() => window.dispatchEvent(new PopStateEvent('popstate'))).not.toThrow();
  });
});
