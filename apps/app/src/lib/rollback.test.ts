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
import { clearAllData, getSetting, setSetting } from './store/db';
import { ownerUserId } from './store/local-user';

/** Ключ снимка в хранилище настроек — тесты читают его напрямую, минуя backup.ts. */
const ROLLBACK_KEY = 'pre-import-rollback';

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

  it('снимок переживает импорт — ради этого он и лежит в настройках', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback();

    // applyBackup чистит только пользовательские хранилища, настройки не трогает.
    await applyBackup({ ...(await buildBackup()), objects: [] });

    const stashed = await takeRollback();
    expect(stashed?.backup.objects.map((o) => o.title)).toEqual(['Мои данные']);
  });

  it('полное удаление данных сносит и снимок — иначе копия документов осталась бы на неделю', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await ownerUserId();
    await stashRollback();

    await clearAllData();

    expect(await getSetting(ROLLBACK_KEY)).toBeUndefined();
    expect(await takeRollback()).toBeNull();
    // Настройки самой установки — не данные, они остаются.
    expect(await getSetting('owner-user-id')).toBeTruthy();
  });

  it('битый снимок не уезжает в базу молча — откат отказывает, снимок остаётся', async () => {
    await ledgerStore.create({ type: 'document', title: 'Мои данные' });
    await stashRollback();

    const stashed = await getSetting<{ backup: { objects: { createdAt: string }[] } }>('pre-import-rollback');
    stashed!.backup.objects[0]!.createdAt = 'позавчера';
    await setSetting(ROLLBACK_KEY, stashed);

    await expect(undoImport()).rejects.toThrow();
    // Испорченный снимок — не повод потерять единственную копию прежних данных.
    expect(await getSetting(ROLLBACK_KEY)).toBeTruthy();
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
    expect(await getSetting(ROLLBACK_KEY)).toBeUndefined();
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
