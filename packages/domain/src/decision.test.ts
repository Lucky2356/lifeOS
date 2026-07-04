import { describe, it, expect } from 'vitest';
import { createDecision, scoreOptions } from './decision';

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
