import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pickText } from '@life-os/domain';
import { ledgerStore, navigatorStore } from '../lib/store';
import { setLocale, t } from '../lib/i18n';
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
    expect(
      await screen.findByText(t('navigator.progress', { done: 1, n: jobLoss.steps.length })),
    ).toBeTruthy();
  });

  it('нетронутая карточка показывает число шагов', async () => {
    renderNavigator();
    expect(await screen.findByText(jobLossTitle)).toBeTruthy();
    expect(screen.getAllByText(t('navigator.stepCount', { n: jobLoss.steps.length })).length).toBeGreaterThan(
      0,
    );
  });

  it('«Назад» из встроенного гида возвращает в плейбук, а не в список', async () => {
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await user.click(await screen.findByRole('button', { name: t('navigator.openGuide') }));
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
    expect(screen.queryByRole('button', { name: t('navigator.restart') })).toBeNull();

    await user.click(screen.getAllByRole('button', { name: t('navigator.stepDone') })[0]!);
    expect(await screen.findByRole('button', { name: t('navigator.restart') })).toBeTruthy();
  });

  it('прочитанный реестр выносит вердикт по каждому требуемому документу', async () => {
    await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await screen.findByText(pickText(jobLoss.summary, 'ru'));

    expect(await screen.findAllByTitle(t('navigator.docOwned'))).toHaveLength(2);
    expect(screen.getAllByTitle(t('navigator.docMissing'))).toHaveLength(3);
  });

  it('непрочитанный реестр не выдаётся за отсутствие документов', async () => {
    // Сбой чтения реестра — не то же самое, что пустой реестр. Человеку в кризисе нельзя сообщать,
    // что у него нет паспорта, который у него есть.
    vi.spyOn(ledgerStore, 'list').mockRejectedValueOnce(new Error('реестр недоступен'));
    const user = userEvent.setup();
    renderNavigator();

    await user.click(await screen.findByText(jobLossTitle));
    await screen.findByText(pickText(jobLoss.summary, 'ru'));

    expect(await screen.findAllByTitle(t('navigator.docUnknown'))).toHaveLength(5);
    expect(screen.queryByTitle(t('navigator.docOwned'))).toBeNull();
    expect(screen.queryByTitle(t('navigator.docMissing'))).toBeNull();
  });

  it('переключение языка переводит и интерфейс, и содержимое пака', async () => {
    // Единственный тест, который что-то доказывает про сам переключатель: остальные сверяют вывод
    // со словарём и прошли бы даже с пустым сообщением. Здесь литералы английские, намеренно.
    setLocale('en');
    const user = userEvent.setup();
    renderNavigator();

    expect(await screen.findByText('Crisis situations')).toBeTruthy();
    expect(screen.getByText('Playbooks for hard situations and bureaucratic guides')).toBeTruthy();

    await user.click(screen.getByText(pickText(jobLoss.title, 'en')));
    expect(await screen.findByRole('button', { name: 'Open guide' })).toBeTruthy();
  });
});
