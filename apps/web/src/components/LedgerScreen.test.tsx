import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { objectTypeLabels } from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { LedgerScreen } from './LedgerScreen';

function renderLedger() {
  return render(<LedgerScreen theme="light" onToggleTheme={() => {}} onSelect={() => {}} />);
}

describe('LedgerScreen — поиск и фильтр по типу', () => {
  beforeEach(async () => {
    await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
    await ledgerStore.create({ type: 'insurance', title: 'ОСАГО' });
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
