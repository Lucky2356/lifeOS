import { describe, it, expect } from 'vitest';
import {
  progressPercent,
  reconcileProgress,
  startProgress,
  toggleStep,
  validateContentPack,
  type Playbook,
} from './content';

const playbook: Playbook = {
  key: 'job_loss',
  kind: 'crisis',
  title: { ru: 'Потеря работы', en: 'Job loss' },
  summary: { ru: '', en: '' },
  steps: [
    {
      key: 's1',
      order: 1,
      title: { ru: 'A', en: 'A' },
      description: { ru: '', en: '' },
      requiredDocumentTypes: [],
      embedsGuideKey: null,
    },
    {
      key: 's2',
      order: 2,
      title: { ru: 'B', en: 'B' },
      description: { ru: '', en: '' },
      requiredDocumentTypes: [],
      embedsGuideKey: null,
    },
  ],
};

const owner = '00000000-0000-0000-0000-000000000001';

describe('progress', () => {
  it('стартует с нулевым прогрессом', () => {
    const p = startProgress(playbook, { packId: 'ru', version: '1.0.0' }, owner);
    expect(progressPercent(p)).toBe(0);
    expect(p.completedAt).toBeNull();
  });

  it('отметка шагов повышает прогресс, все шаги → completedAt', () => {
    let p = startProgress(playbook, { packId: 'ru', version: '1.0.0' }, owner);
    p = toggleStep(p, 's1');
    expect(progressPercent(p)).toBe(0.5);
    p = toggleStep(p, 's2');
    expect(progressPercent(p)).toBe(1);
    expect(p.completedAt).not.toBeNull();
  });
});

const pack = { packId: 'ru', version: '1.0.0' };

/** Тот же плейбук после обновления пака: шаг s2 убрали, s3 добавили. */
const changed: Playbook = {
  ...playbook,
  steps: [
    playbook.steps[0],
    {
      key: 's3',
      order: 2,
      title: { ru: 'C', en: 'C' },
      description: { ru: '', en: '' },
      requiredDocumentTypes: [],
      embedsGuideKey: null,
    },
  ],
};

describe('reconcileProgress', () => {
  it('добавленный шаг попадает в подсчёт неотмеченным', () => {
    const p = reconcileProgress(startProgress(playbook, pack, owner), changed, pack);
    expect(Object.keys(p.stepStates)).toEqual(['s1', 's3']);
    expect(p.stepStates.s3).toBe(false);
  });

  it('сохраняет отметки уцелевших шагов и забывает исчезнувшие', () => {
    const started = toggleStep(toggleStep(startProgress(playbook, pack, owner), 's1'), 's2');
    const p = reconcileProgress(started, changed, pack);
    expect(p.stepStates.s1).toBe(true);
    expect(p.stepStates).not.toHaveProperty('s2');
    expect(progressPercent(p)).toBe(0.5);
  });

  it('завершённый плейбук с новым шагом снова не завершён', () => {
    const done = toggleStep(toggleStep(startProgress(playbook, pack, owner), 's1'), 's2');
    expect(done.completedAt).not.toBeNull();
    expect(reconcileProgress(done, changed, pack).completedAt).toBeNull();
  });

  it('не трогает completedAt, если все шаги на месте и отмечены', () => {
    const done = toggleStep(toggleStep(startProgress(playbook, pack, owner), 's1'), 's2');
    expect(reconcileProgress(done, playbook, pack).completedAt).toBe(done.completedAt);
  });

  it('повторное согласование ничего не меняет', () => {
    const once = reconcileProgress(startProgress(playbook, pack, owner), changed, pack);
    expect(reconcileProgress(once, changed, pack)).toEqual(once);
  });

  it('запоминает версию пака, по которой согласован прогресс', () => {
    const p = reconcileProgress(startProgress(playbook, pack, owner), changed, {
      packId: 'ru',
      version: '1.1.0',
    });
    expect(p.packVersion).toBe('1.1.0');
  });
});

describe('validateContentPack', () => {
  it('валидирует корректный пак', () => {
    const pack = validateContentPack({
      packId: 'ru',
      version: '1.0.0',
      region: 'RU',
      locales: ['ru', 'en'],
      playbooks: [playbook],
    });
    expect(pack.playbooks).toHaveLength(1);
  });

  it('отклоняет пак без обязательных полей', () => {
    expect(() => validateContentPack({ packId: 'ru' })).toThrow();
  });
});
