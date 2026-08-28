import { describe, expect, it } from 'vitest';
import {
  applyBackup,
  buildBackup,
  dropRollback,
  rollbackKeepDays,
  stashRollback,
  takeRollback,
  undoImport,
} from './backup';
import { ledgerStore } from './store/objects';
import { getSetting, setSetting } from './store/db';

describe('страховка перед восстановлением из копии', () => {
  it('возвращает данные, какими они были до импорта', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });

    expect(await stashRollback()).toBe(true);

    // Импорт чужой копии: своё заменяется целиком — ровно то, что происходит в настройках.
    const foreign = await buildBackup();
    await ledgerStore.create({ type: 'insurance', title: 'Чужие данные' });
    const other = await buildBackup();
    await applyBackup({ ...other, objects: other.objects.filter((o) => o.title === 'Чужие данные') });
    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Чужие данные']);
    expect(foreign.objects).toHaveLength(1);

    expect(await undoImport()).toBe(true);
    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Мои данные']);
  });

  it('снимок переживает полную очистку данных — он лежит в настройках', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback();

    const { clearAllData } = await import('./store/db');
    await clearAllData();

    const stashed = await takeRollback();
    expect(stashed?.backup.objects.map((o) => o.title)).toEqual(['Мои данные']);
  });

  it('после отката снимок убирается — второй раз откатывать нечего', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback();
    await undoImport();

    expect(await takeRollback()).toBeNull();
    expect(await undoImport()).toBe(false);
  });

  it('протухший снимок не предлагается и убирается сам', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback(new Date(Date.now() - (rollbackKeepDays + 1) * 86_400_000));

    expect(await takeRollback()).toBeNull();
    expect(await getSetting('pre-import-rollback')).toBeUndefined();
  });

  it('снимок не откладывается, если вложения не помещаются', async () => {
    const created = await ledgerStore.create({ type: 'document', title: 'Паспорт' });
    // Метаданные вложения с неподъёмным размером: строить копию ради отказа не нужно.
    await setSetting('unused', null);
    const database = await (await import('./store/db')).db();
    await database.put('attachments', {
      id: '018f3a2e-0000-7000-8000-0000000000aa',
      objectId: created.id,
      ownerUserId: created.ownerUserId,
      filename: 'huge.pdf',
      mime: 'application/pdf',
      size: 200 * 1024 * 1024,
      sensitivity: 'normal',
      createdAt: new Date().toISOString(),
    });

    expect(await stashRollback()).toBe(false);
    expect(await takeRollback()).toBeNull();
  });

  it('снимок можно убрать вручную — «оставить восстановленное»', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback();
    await dropRollback();
    expect(await takeRollback()).toBeNull();
  });
});
