import { describe, it, expect } from 'vitest';
import {
  applyDecisionUpdate,
  createDecision,
  decideDecision,
  recordOutcome,
  reopenDecision,
  scoreOptions,
} from './decision';

const OWNER = '00000000-0000-0000-0000-000000000001';

describe('scoreOptions', () => {
  const criteria = [
    { id: 'price', label: 'Цена', weight: 3 },
    { id: 'comfort', label: 'Комфорт', weight: 1 },
  ];
  const options = [
    { id: 'a', label: 'Вариант A', scores: { price: 2, comfort: 5 } },
    { id: 'b', label: 'Вариант B', scores: { price: 5, comfort: 1 } },
  ];

  it('считает взвешенный балл и сортирует по убыванию', () => {
    const result = scoreOptions({ criteria, options });
    // A: 3*2 + 1*5 = 11 ; B: 3*5 + 1*1 = 16
    expect(result).toEqual([
      { optionId: 'b', label: 'Вариант B', total: 16 },
      { optionId: 'a', label: 'Вариант A', total: 11 },
    ]);
  });

  it('отсутствующая оценка считается нулём', () => {
    const result = scoreOptions({ criteria, options: [{ id: 'c', label: 'C', scores: { price: 4 } }] });
    expect(result[0]?.total).toBe(12);
  });
});

describe('createDecision', () => {
  it('создаёт черновик без критериев и вариантов', () => {
    const d = createDecision({ title: 'Сменить работу' }, '00000000-0000-0000-0000-000000000001');
    expect(d.status).toBe('draft');
    expect(d.criteria).toHaveLength(0);
    expect(d.options).toHaveLength(0);
    expect(d.chosenOptionId).toBeNull();
  });
});

describe('жизненный цикл решения', () => {
  const withOptions = () => {
    const d = createDecision({ title: 'Менять ли работу' }, OWNER);
    return applyDecisionUpdate(d, {
      options: [
        { id: 'a', label: 'Остаться', scores: {} },
        { id: 'b', label: 'Уйти', scores: {} },
      ],
    });
  };

  it('фиксирует выбор, статус и дату', () => {
    const decided = decideDecision(withOptions(), 'b', new Date('2026-08-21T10:00:00.000Z'));
    expect(decided.status).toBe('decided');
    expect(decided.chosenOptionId).toBe('b');
    expect(decided.decidedAt).toBe('2026-08-21T10:00:00.000Z');
  });

  it('не даёт выбрать вариант, которого нет', () => {
    expect(() => decideDecision(withOptions(), 'нет-такого')).toThrow();
  });

  it('исход записывается только для принятого решения', () => {
    const draft = withOptions();
    expect(() => recordOutcome(draft, 'вышло так себе')).toThrow();

    const decided = decideDecision(draft, 'a');
    expect(recordOutcome(decided, 'вышло хорошо').actualOutcome).toBe('вышло хорошо');
  });

  it('возврат в черновик снимает выбор и стирает исход', () => {
    const decided = decideDecision(withOptions(), 'a');
    const withOutcome = recordOutcome(decided, 'вышло хорошо');
    const reopened = reopenDecision(withOutcome);

    expect(reopened.status).toBe('draft');
    expect(reopened.chosenOptionId).toBeNull();
    expect(reopened.decidedAt).toBeNull();
    expect(reopened.actualOutcome).toBeNull();
  });
});
