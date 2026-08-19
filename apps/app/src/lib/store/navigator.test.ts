import { describe, it, expect } from 'vitest';
import { navigatorStore } from './navigator';

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
