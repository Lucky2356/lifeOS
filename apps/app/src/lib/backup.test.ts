import { describe, it, expect } from 'vitest';
import {
  applyBackup,
  BackupEncrypted,
  BackupCorrupted,
  BackupInvalid,
  backupToBlob,
  BackupTooNew,
  readBackupFile,
  summarize,
} from './backup';
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

/** Поля копии, которые тесты портят намеренно. */
interface RawBackup {
  schema: number;
  objects: { createdAt: string }[];
  attachments: { data: string }[];
}

/** Файл копии с намеренно испорченным содержимым: так проверяются повреждения и чужие поколения. */
async function tamperedBackup(edit: (raw: RawBackup) => void): Promise<File> {
  const raw = JSON.parse(await (await backupToBlob()).text()) as RawBackup;
  edit(raw);
  return asFile(new Blob([JSON.stringify(raw)]));
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
    await expect(readBackupFile(junk)).rejects.toThrow(BackupInvalid);

    const notJson = new File(['совсем не json'], 'x.json', { type: 'application/json' });
    await expect(readBackupFile(notJson)).rejects.toThrow(BackupInvalid);

    expect(await ledgerStore.list()).toHaveLength(1);
  });

  it('копия из более новой версии опознаётся как копия, а не как чужой файл', async () => {
    await seed();
    const future = await tamperedBackup((raw) => {
      raw.schema = 2;
    });

    await expect(readBackupFile(future)).rejects.toThrow(BackupTooNew);
    expect(await ledgerStore.list()).toHaveLength(1);
  });

  it('битая копия называет, что именно не сошлось', async () => {
    await seed();
    const broken = await tamperedBackup((raw) => {
      raw.objects[0]!.createdAt = 'позавчера';
    });

    await expect(readBackupFile(broken)).rejects.toThrow(BackupCorrupted);
    await expect(readBackupFile(broken)).rejects.toThrow(/objects\.0\.createdAt/);
  });

  it('копия с повреждённым содержимым вложения отклоняется на чтении', async () => {
    await seed();
    const broken = await tamperedBackup((raw) => {
      raw.attachments[0]!.data = 'это не base64!';
    });

    // Конверт свой, поэтому это не «чужой файл», а именно повреждение — с указанием места.
    await expect(readBackupFile(broken)).rejects.toThrow(BackupCorrupted);
    await expect(readBackupFile(broken)).rejects.toThrow(/attachments\.0\.data/);
    expect(await ledgerStore.list()).toHaveLength(1);
  });

  it('повреждённое вложение не оставляет базу наполовину стёртой', async () => {
    // Схема ловит такое раньше, но applyBackup зовётся и со снимком отката, минуя чтение файла.
    // Раскодирование вынесено до открытия транзакции, чтобы падать внутри неё было негде.
    // fake-indexeddb очистку при броске не коммитит, поэтому здесь проверяется свойство, а не
    // конкретный порядок: данные после отказа целы.
    const { obj } = await seed();
    const backup = await readBackupFile(await asFile(await backupToBlob()));

    await expect(
      applyBackup({ ...backup, attachments: [{ ...backup.attachments[0]!, data: 'не base64!' }] }),
    ).rejects.toThrow();

    expect((await ledgerStore.list()).map((o) => o.title)).toEqual(['Загранпаспорт']);
    expect(await attachmentsStore.list(obj.id)).toHaveLength(1);
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
