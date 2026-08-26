import { describe, it, expect } from 'vitest';
import { createLifeObject } from '@life-os/domain';
import { lifecyclePill } from './object-visuals';

const OWNER = '00000000-0000-0000-0000-0000000000a1';
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe('lifecyclePill', () => {
  const make = (validUntil: string | null) =>
    createLifeObject({ type: 'document', title: 'Паспорт', validUntil }, OWNER);

  it('просроченное показывает срок и тревожный цвет', () => {
    expect(lifecyclePill(make(inDays(-4)))).toMatchObject({ cls: 'pill-overdue' });
  });

  it('приближающееся показывает, сколько осталось', () => {
    expect(lifecyclePill(make(inDays(11)))).toMatchObject({ cls: 'pill-due', label: 'через 11 дн.' });
  });

  it('без срока — нейтрально', () => {
    expect(lifecyclePill(make(null))).toMatchObject({ cls: 'pill-none', label: 'без срока' });
  });

  it('архивное не кричит о просрочке', () => {
    const archived = { ...make(inDays(-4)), status: 'archived' as const };
    expect(lifecyclePill(archived)).toEqual({ cls: 'pill-none', label: 'в архиве' });
  });
});
