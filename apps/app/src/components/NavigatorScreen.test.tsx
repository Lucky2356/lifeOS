import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pickText } from '@life-os/domain';
import { navigatorStore } from '../lib/store';
import { NavigatorScreen } from './NavigatorScreen';

function renderNavigator() {
  return render(<NavigatorScreen theme="light" onToggleTheme={() => {}} />);
}

const jobLoss = navigatorStore.playbook('job_loss');
const jobLossTitle = pickText(jobLoss.title, 'ru');
const guideTitle = pickText(navigatorStore.playbook('unemployment_benefit').title, 'ru');

describe('NavigatorScreen', () => {
  it('карточка начатого плейбука показывает прогресс вместо числа шагов', async () => {
    const progress = await navigatorStore.start(jobLoss.key);
    await navigatorStore.toggleStep(progress.id, jobLoss.steps[0]!.key);

    renderNavigator();
    expect(await screen.findByText(`1 из ${jobLoss.steps.length} шагов`)).toBeTruthy();
  });

  it('нетронутая карточка показывает число шагов', async () => {
    renderNavigator();
    expect(await screen.findByText(jobLossTitle)).toBeTruthy();
    expect(screen.getAllByText(`${jobLoss.steps.length} шага`).length).toBeGreaterThan(0);
  });

  it('«Назад» из встроенного гида возвращает в плейбук, а не в список', async () => {
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await user.click(await screen.findByRole('button', { name: 'Открыть гид' }));
    expect(await screen.findByText(guideTitle)).toBeTruthy();

    // Кнопка возврата названа родительским плейбуком — по ней и видно, куда она ведёт.
    await user.click(screen.getByRole('button', { name: jobLossTitle }));
    expect(await screen.findByText(pickText(jobLoss.summary, 'ru'))).toBeTruthy();
  });

  it('«Начать заново» появляется только когда есть что сбрасывать', async () => {
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await screen.findByText(pickText(jobLoss.summary, 'ru'));
    expect(screen.queryByRole('button', { name: 'Начать заново' })).toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Отметить готовым' })[0]!);
    expect(await screen.findByRole('button', { name: 'Начать заново' })).toBeTruthy();
  });
});
