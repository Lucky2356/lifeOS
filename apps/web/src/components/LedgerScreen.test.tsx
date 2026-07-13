import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLifeObject, objectTypeLabels } from '@life-os/domain';
import { LedgerScreen } from './LedgerScreen';

const owner = '00000000-0000-0000-0000-0000000000a1';

function renderLedger() {
  return render(<LedgerScreen theme="light" onToggleTheme={() => {}} onSelect={() => {}} />);
}

describe('LedgerScreen — поиск и фильтр по типу', () => {
  beforeEach(() => {
    localStorage.clear();
    // локальный режим: list() отдаёт объекты из кэша без сети
    localStorage.setItem('los-local', '1');
    localStorage.setItem('los-user', owner);
    const objs = [
      createLifeObject({ type: 'document', title: 'Загранпаспорт' }, owner),
      createLifeObject({ type: 'insurance', title: 'ОСАГО' }, owner),
    ];
    localStorage.setItem('los-objects-cache', JSON.stringify(objs));
  });

  it('ввод в поиск сужает список по названию', async () => {
    const user = userEvent.setup();
    renderLedger();
    expect(await screen.findByText('Загранпаспорт')).toBeTruthy();
    expect(screen.getByText('ОСАГО')).toBeTruthy();

    await user.type(screen.getByPlaceholderText('Поиск по реестру'), 'загран');
    expect(screen.getByText('Загранпаспорт')).toBeTruthy();
    expect(screen.queryByText('ОСАГО')).toBeNull();
  });

  it('клик по чипу типа оставляет только объекты этого типа', async () => {
    const user = userEvent.setup();
    renderLedger();
    await screen.findByText('Загранпаспорт');

    await user.click(screen.getByRole('button', { name: objectTypeLabels.insurance.ru }));
    expect(screen.queryByText('Загранпаспорт')).toBeNull();
    expect(screen.getByText('ОСАГО')).toBeTruthy();
  });

  it('модалка добавления закрывается по Escape (a11y)', async () => {
    const user = userEvent.setup();
    renderLedger();
    await screen.findByText('Загранпаспорт');

    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(screen.getByText('Новый объект')).toBeTruthy(); // модалка открыта
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Новый объект')).toBeNull(); // закрылась
  });
});
