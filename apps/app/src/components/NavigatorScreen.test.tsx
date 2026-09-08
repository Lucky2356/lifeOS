import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pickText } from '@life-os/domain';
import { ledgerStore, navigatorStore } from '../lib/store';
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

  it('прочитанный реестр выносит вердикт по каждому требуемому документу', async () => {
    await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await screen.findByText(pickText(jobLoss.summary, 'ru'));

    expect(await screen.findAllByTitle('Есть в реестре')).toHaveLength(2);
    expect(screen.getAllByTitle('В реестре не нашлось')).toHaveLength(3);
  });

  it('непрочитанный реестр не выдаётся за отсутствие документов', async () => {
    // Сбой чтения реестра — не то же самое, что пустой реестр. Человеку в кризисе нельзя сообщать,
    // что у него нет паспорта, который у него есть.
    vi.spyOn(ledgerStore, 'list').mockRejectedValueOnce(new Error('реестр недоступен'));
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await screen.findByText(pickText(jobLoss.summary, 'ru'));

    expect(await screen.findAllByTitle('Реестр не прочитан')).toHaveLength(5);
    expect(screen.queryByTitle('Есть в реестре')).toBeNull();
    expect(screen.queryByTitle('В реестре не нашлось')).toBeNull();
  });
});
