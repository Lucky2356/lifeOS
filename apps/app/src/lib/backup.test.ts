import { describe, it, expect } from 'vitest';
import { applyBackup, BackupEncrypted, backupToBlob, readBackupFile, summarize } from './backup';
import { attachmentsStore } from './store/attachments';
import { ledgerStore } from './store/objects';
import { decisionsStore } from './store/decisions';
import { householdStore } from './store/household';
import { clearAllData } from './store/db';

function pdfFile(name = 'doc.pdf', body = 'содержимое'): File {
  const head = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  return new File([head, body], name, { type: 'application/pdf' });
}

async function seed() {
  const obj = await ledgerStore.create({ type: 'document', title: 'Загранпаспорт' });
  await decisionsStore.create({ title: 'Менять ли работу' });
  const house = await householdStore.create('Наш дом', 'Алекс');
  await householdStore.createTask(house.id, { title: 'Вынести мусор' });
  const attachment = await attachmentsStore.add(obj.id, pdfFile());
  return { obj, attachment };
}

/** Blob из экспорта — снова File, как будто пользователь выбрал его в диалоге. */
async function asFile(blob: Blob): Promise<File> {
  return new File([await blob.text()], 'life-os-backup.json', { type: 'application/json' });
}

describe('резервная копия', () => {
  it('экспорт → удаление → импорт восстанавливает данные и файлы', async () => {
    const { obj, attachment } = await seed();
    const exported = await asFile(await backupToBlob());

    await clearAllData();
    expect(await ledgerStore.list()).toEqual([]);

    const backup = await readBackupFile(exported);
    await applyBackup(backup);

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Загранпаспорт']);
    expect((await decisionsStore.list()).map((d) => d.title)).toEqual(['Менять ли работу']);
    const house = await householdStore.current();
    expect(house).not.toBeNull();
    expect((await householdStore.tasks(house!.id)).map((t) => t.title)).toEqual(['Вынести мусор']);

    const restored = await attachmentsStore.list(obj.id);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: attachment.id, filename: 'doc.pdf', mime: 'application/pdf' });
  });

  it('содержимое файла переживает круг экспорт-импорт байт в байт', async () => {
    const obj = await ledgerStore.create({ type: 'document', title: 'Договор' });
    const original = pdfFile('contract.pdf', 'строка с ю́никодом ✓');
    const added = await attachmentsStore.add(obj.id, original);

    const exported = await asFile(await backupToBlob());
    await clearAllData();
    await applyBackup(await readBackupFile(exported));

    const { bytes } = await attachmentsStore.read(added.id);
    expect([...new Uint8Array(bytes)]).toEqual([...new Uint8Array(await original.arrayBuffer())]);
  });

  it('сводка считает содержимое копии', async () => {
    await seed();
    const backup = await readBackupFile(await asFile(await backupToBlob()));
    expect(summarize(backup)).toMatchObject({
      objects: 1,
      decisions: 1,
      tasks: 1,
      members: 1,
      attachments: 1,
    });
  });

  it('посторонний файл отклоняется, данные не трогаются', async () => {
    await seed();
    const junk = new File(['{"hello":"world"}'], 'junk.json', { type: 'application/json' });
    await expect(readBackupFile(junk)).rejects.toThrow();

    const notJson = new File(['совсем не json'], 'x.json', { type: 'application/json' });
    await expect(readBackupFile(notJson)).rejects.toThrow();

    expect(await ledgerStore.list()).toHaveLength(1);
  });

  it('импорт заменяет прежние данные, а не смешивается с ними', async () => {
    await ledgerStore.create({ type: 'document', title: 'Старый' });
    const exported = await asFile(await backupToBlob());

    await clearAllData();
    await ledgerStore.create({ type: 'insurance', title: 'Новый' });
    await applyBackup(await readBackupFile(exported));

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Старый']);
  });
});

describe('копия с паролем', () => {
  it('зашифрованная копия проходит полный круг', async () => {
    await seed();
    const exported = await asFile(await backupToBlob('пароль-от-копии'));

    // Без пароля файл не открыть, но и данные не потеряны.
    await expect(readBackupFile(exported)).rejects.toThrow(BackupEncrypted);
    await expect(readBackupFile(exported, 'не тот')).rejects.toThrow();

    await clearAllData();
    await applyBackup(await readBackupFile(exported, 'пароль-от-копии'));

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Загранпаспорт']);
    expect(await attachmentsStore.list((await ledgerStore.list())[0]!.id)).toHaveLength(1);
  });

  it('в зашифрованном файле не видно содержимого', async () => {
    await seed();
    const text = await (await backupToBlob('пароль')).text();
    expect(text).not.toContain('Загранпаспорт');
    expect(text).toContain('LIFEOS-ENC1');
  });

  it('без пароля копия остаётся обычным читаемым JSON', async () => {
    await seed();
    const text = await (await backupToBlob()).text();
    expect(text).toContain('Загранпаспорт');
  });
});
