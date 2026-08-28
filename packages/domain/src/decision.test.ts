import { describe, it, expect } from 'vitest';
import {
  applyDecisionUpdate,
  createDecision,
  decideDecision,
  recordOutcome,
  reopenDecision,
  reviewDateAfter,
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
    const decided = decideDecision(withOptions(), 'b', 0, new Date('2026-08-21T10:00:00.000Z'));
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

describe('возврат к решению', () => {
  const withOptions = () => {
    const d = createDecision({ title: 'Менять ли работу' }, OWNER);
    return applyDecisionUpdate(d, {
      options: [{ id: 'a', label: 'Остаться', scores: {} }],
    });
  };

  it('назначает дату возврата через выбранное число месяцев', () => {
    const decided = decideDecision(withOptions(), 'a', 6, new Date('2026-08-21T10:00:00.000Z'));
    // Полдень по месту, а не UTC: напоминание должно приходить днём в часовом поясе человека.
    const at = new Date(decided.reviewAt!);
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2027, 1, 21, 12]);
  });

  it('без напоминания даты возврата нет', () => {
    const decided = decideDecision(withOptions(), 'a', 0, new Date('2026-08-21T10:00:00.000Z'));
    expect(decided.reviewAt).toBeNull();
  });

  it('записанный исход снимает напоминание — возвращаться больше незачем', () => {
    const decided = decideDecision(withOptions(), 'a', 3, new Date('2026-08-21T10:00:00.000Z'));
    expect(recordOutcome(decided, 'вышло лучше ожидаемого').reviewAt).toBeNull();
  });

  it('возврат в черновик снимает и дату возврата', () => {
    const decided = decideDecision(withOptions(), 'a', 3, new Date('2026-08-21T10:00:00.000Z'));
    expect(reopenDecision(decided).reviewAt).toBeNull();
  });

  it('reviewDateAfter переносит на существующую дату следующего месяца', () => {
    // 31 декабря + 2 месяца: февраля 31-го не существует, Date сам переносит вперёд.
    const at = new Date(reviewDateAfter(2, new Date('2026-12-31T08:00:00.000Z'))!);
    expect([at.getMonth(), at.getDate()]).toEqual([2, 3]);
    expect(reviewDateAfter(0)).toBeNull();
    expect(reviewDateAfter(-3)).toBeNull();
  });
});
