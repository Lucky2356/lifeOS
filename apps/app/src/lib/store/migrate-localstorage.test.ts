import { describe, it, expect, beforeEach } from 'vitest';
import { createLifeObject, createHousehold, createHouseholdTask } from '@life-os/domain';
import { migrateLegacyLocalStorage } from './migrate-localstorage';
import { ledgerStore } from './objects';
import { householdStore } from './household';

const OWNER = '00000000-0000-0000-0000-0000000000a1';

describe('migrateLegacyLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('переносит объекты и задачи прежнего локального режима', async () => {
    const house = createHousehold('Наш дом', OWNER);
    localStorage.setItem(
      'los-objects-cache',
      JSON.stringify([createLifeObject({ type: 'document', title: 'Загранпаспорт' }, OWNER)]),
    );
    localStorage.setItem('los-households-cache', JSON.stringify([house]));
    localStorage.setItem(
      `los-htasks-${house.id}`,
      JSON.stringify([createHouseholdTask({ title: 'Вынести мусор' }, house.id)]),
    );

    await migrateLegacyLocalStorage();

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Загранпаспорт']);
    expect((await householdStore.current())?.id).toBe(house.id);
    expect((await householdStore.tasks(house.id)).map((t) => t.title)).toEqual(['Вынести мусор']);
  });

  it('пропускает битые записи, но переносит целые', async () => {
    localStorage.setItem(
      'los-objects-cache',
      JSON.stringify([
        { id: 'не-uuid', title: 'мусор' },
        createLifeObject({ type: 'document', title: 'Полис' }, OWNER),
      ]),
    );

    await migrateLegacyLocalStorage();

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Полис']);
  });

  it('убирает прежние ключи, но оставляет тему, и не повторяет перенос', async () => {
    localStorage.setItem(
      'los-objects-cache',
      JSON.stringify([createLifeObject({ type: 'document', title: 'Полис' }, OWNER)]),
    );
    localStorage.setItem('los-theme', 'dark');
    localStorage.setItem('los-outbox', '[]');

    await migrateLegacyLocalStorage();

    expect(localStorage.getItem('los-objects-cache')).toBeNull();
    expect(localStorage.getItem('los-outbox')).toBeNull();
    expect(localStorage.getItem('los-theme')).toBe('dark');

    // Повторный запуск не должен ничего продублировать.
    await migrateLegacyLocalStorage();
    expect(await ledgerStore.list()).toHaveLength(1);
  });

  it('без прежних данных проходит молча', async () => {
    await migrateLegacyLocalStorage();
    expect(await ledgerStore.list()).toEqual([]);
  });
});
