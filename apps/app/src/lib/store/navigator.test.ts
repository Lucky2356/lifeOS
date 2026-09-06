import { describe, it, expect } from 'vitest';
import { navigatorStore } from './navigator';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Прогресс, записанный прежней версией пака: часть шагов ещё не существовала, а шаг «удалённый»
 * с тех пор из плейбука убрали. Ровно это лежит в базе у пользователя после обновления приложения.
 */
async function staleProgress(playbookKey: string, stepStates: Record<string, boolean>) {
  const progress = {
    id: crypto.randomUUID(),
    ownerUserId: await ownerUserId(),
    packId: 'ru',
    packVersion: '0.9.0',
    playbookKey,
    stepStates,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  await (await db()).put('progress', progress);
  return progress;
}

describe('navigatorStore', () => {
  it('плейбуки доступны из вшитого контент-пака, без сети', () => {
    const all = navigatorStore.playbooks();
    expect(all.length).toBeGreaterThan(0);
    expect(navigatorStore.playbooks('crisis').every((p) => p.kind === 'crisis')).toBe(true);
  });

  it('неизвестный ключ плейбука — ошибка', () => {
    expect(() => navigatorStore.playbook('нет-такого')).toThrow();
  });

  it('повторный старт возвращает тот же прогресс, а не начинает заново', async () => {
    const key = navigatorStore.playbooks()[0]!.key;
    const first = await navigatorStore.start(key);
    const second = await navigatorStore.start(key);
    expect(second.id).toBe(first.id);
    expect(await navigatorStore.progress()).toHaveLength(1);
  });

  it('прогресс прежней версии пака согласуется с текущими шагами', async () => {
    const playbook = navigatorStore.playbooks()[0]!;
    const first = playbook.steps[0]!.key;
    await staleProgress(playbook.key, { [first]: true, 'шаг-которого-больше-нет': true });

    const started = await navigatorStore.start(playbook.key);
    expect(Object.keys(started.stepStates)).toEqual(playbook.steps.map((s) => s.key));
    expect(started.stepStates[first]).toBe(true);
    expect(started.packVersion).not.toBe('0.9.0');
  });

  it('переключение шага не воскрешает ключи прежней версии', async () => {
    const playbook = navigatorStore.playbooks()[0]!;
    const first = playbook.steps[0]!.key;
    const stale = await staleProgress(playbook.key, { 'шаг-которого-больше-нет': true });

    const toggled = await navigatorStore.toggleStep(stale.id, first);
    expect(toggled.stepStates).not.toHaveProperty('шаг-которого-больше-нет');
    expect(toggled.stepStates[first]).toBe(true);
  });

  it('reset забывает прогресс по плейбуку', async () => {
    const key = navigatorStore.playbooks()[0]!.key;
    await navigatorStore.start(key);
    await navigatorStore.reset(key);
    expect(await navigatorStore.progress()).toHaveLength(0);
  });

  it('прогресс по исчезнувшему из пака плейбуку не показывается, но и не стирается', async () => {
    await staleProgress('плейбук-из-прежнего-пака', { s1: true });
    expect(await navigatorStore.progress()).toHaveLength(0);
    expect(await (await db()).getAll('progress')).toHaveLength(1);
  });

  it('шаги переключаются и сохраняются', async () => {
    const playbook = navigatorStore.playbooks()[0]!;
    const stepKey = playbook.steps[0]!.key;
    const progress = await navigatorStore.start(playbook.key);
    expect(progress.stepStates[stepKey]).toBe(false);

    const toggled = await navigatorStore.toggleStep(progress.id, stepKey);
    expect(toggled.stepStates[stepKey]).toBe(true);
    expect((await navigatorStore.progress())[0]?.stepStates[stepKey]).toBe(true);
  });
});
