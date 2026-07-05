import { describe, it, expect } from 'vitest';
import { defaultAiSettings, isAiEnabled, mergeAiSettings } from './ai';

describe('AI optional layer', () => {
  it('по умолчанию ИИ выключен глобально (core не зависит от ИИ)', () => {
    expect(defaultAiSettings.globalEnabled).toBe(false);
    for (const m of ['ledger', 'household', 'decision', 'navigator'] as const) {
      expect(isAiEnabled(defaultAiSettings, m)).toBe(false);
    }
  });

  it('модуль включён только когда включён и глобальный, и модульный тумблер', () => {
    const on = mergeAiSettings(defaultAiSettings, { globalEnabled: true });
    expect(isAiEnabled(on, 'ledger')).toBe(true); // ledger по умолчанию true
    expect(isAiEnabled(on, 'household')).toBe(false); // household по умолчанию false
  });

  it('глобальный выключатель перекрывает модульные', () => {
    const s = mergeAiSettings(defaultAiSettings, {
      globalEnabled: false,
      perModule: { ledger: true, household: true, decision: true, navigator: true },
    });
    expect(isAiEnabled(s, 'ledger')).toBe(false);
  });

  it('mergeAiSettings сливает perModule, не затирая', () => {
    const s = mergeAiSettings(defaultAiSettings, { perModule: { household: true } });
    expect(s.perModule.household).toBe(true);
    expect(s.perModule.ledger).toBe(true);
  });
});
