import { describe, it, expect } from 'vitest';
import { progressPercent, startProgress, toggleStep, validateContentPack, type Playbook } from './content';

const playbook: Playbook = {
  key: 'job_loss',
  kind: 'crisis',
  title: { ru: 'Потеря работы', en: 'Job loss' },
  summary: { ru: '', en: '' },
  steps: [
    { key: 's1', order: 1, title: { ru: 'A', en: 'A' }, description: { ru: '', en: '' }, requiredDocumentTypes: [], embedsGuideKey: null },
    { key: 's2', order: 2, title: { ru: 'B', en: 'B' }, description: { ru: '', en: '' }, requiredDocumentTypes: [], embedsGuideKey: null },
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
