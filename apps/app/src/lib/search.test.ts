import { describe, it, expect } from 'vitest';
import { searchEverything } from './search';
import { ledgerStore } from './store/objects';
import { decisionsStore } from './store/decisions';
import { householdStore } from './store/household';

async function seed() {
  await ledgerStore.create({ type: 'insurance', title: 'ОСАГО на RAV4' });
  await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
  const house = await householdStore.create('Наш дом', 'Алекс');
  await householdStore.createTask(house.id, { title: 'Продлить ОСАГО' });
  await decisionsStore.create({ title: 'Менять ли машину', context: 'Пробег и ОСАГО' });
}

describe('поиск по всему приложению', () => {
  it('находит одно слово во всех разделах сразу', async () => {
    await seed();
    const hits = await searchEverything('осаго');
    expect(hits.map((h) => h.kind).sort()).toEqual(['decision', 'object', 'task']);
  });

  it('пустой запрос ничего не ищет', async () => {
    await seed();
    expect(await searchEverything('   ')).toEqual([]);
  });

  it('ищет по плейбукам из контент-пака', async () => {
    const hits = await searchEverything('работы');
    expect(hits.some((h) => h.kind === 'playbook')).toBe(true);
  });

  it('регистр не важен', async () => {
    await seed();
    expect((await searchEverything('ЗАГРАНПАСПОРТ')).length).toBeGreaterThan(0);
  });

  it('отмечает архивные объекты', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Старый полис' });
    await ledgerStore.update(obj.id, { status: 'archived' });
    const hit = (await searchEverything('старый полис')).find((h) => h.kind === 'object');
    expect(hit?.subtitle).toContain('в архиве');
  });

  it('ничего не находит по бессмыслице', async () => {
    await seed();
    expect(await searchEverything('щщщ')).toEqual([]);
  });
});
