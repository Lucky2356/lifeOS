import { z } from 'zod';
import {
  attachmentSchema,
  decisionSchema,
  householdSchema,
  householdTaskSchema,
  lifeObjectSchema,
  membershipSchema,
  playbookProgressSchema,
} from '@life-os/domain';
import { db, dataStores, getSetting, setSetting } from './store/db';
import { decryptBackup, encryptBackup, isEncryptedBackup } from './backup-crypto';

/**
 * Резервная копия — единственный способ вынести данные с устройства (ADR 0006). Сервера нет,
 * поэтому снос приложения без бэкапа означает потерю всего: экспорт здесь не удобство, а страховка.
 *
 * Формат — один JSON: записи как есть плюс содержимое файлов в base64. Читаемо, без зависимостей
 * на архиватор, переносится между устройствами и платформами.
 */

const CURRENT_SCHEMA = 1;

const backupAttachmentSchema = attachmentSchema.extend({
  /**
   * Содержимое файла в base64. Проверяется именно как base64, а не просто как строка: иначе
   * повреждённое содержимое доходит до применения копии и роняет atob уже внутри транзакции.
   */
  data: z.string().base64(),
});

export const backupSchema = z.object({
  app: z.literal('life-os'),
  schema: z.literal(CURRENT_SCHEMA),
  exportedAt: z.string().datetime(),
  appVersion: z.string(),
  objects: z.array(lifeObjectSchema),
  decisions: z.array(decisionSchema),
  households: z.array(householdSchema),
  members: z.array(membershipSchema),
  tasks: z.array(householdTaskSchema),
  progress: z.array(playbookProgressSchema),
  attachments: z.array(backupAttachmentSchema),
});

export type Backup = z.infer<typeof backupSchema>;

export interface BackupSummary {
  exportedAt: string;
  appVersion: string;
  objects: number;
  decisions: number;
  members: number;
  tasks: number;
  progress: number;
  attachments: number;
}

/** btoa не принимает большие строки целиком — кодируем порциями. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let out = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const raw = atob(data);
  // ArrayBuffer задаётся явно: иначе TS выводит ArrayBufferLike, который не годится для Blob.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function backupFilename(now: Date = new Date()): string {
  return `life-os-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function summarize(backup: Backup): BackupSummary {
  return {
    exportedAt: backup.exportedAt,
    appVersion: backup.appVersion,
    objects: backup.objects.length,
    decisions: backup.decisions.length,
    members: backup.members.length,
    tasks: backup.tasks.length,
    progress: backup.progress.length,
    attachments: backup.attachments.length,
  };
}

/** Собрать полную копию всех данных устройства. */
export async function buildBackup(now: Date = new Date()): Promise<Backup> {
  const database = await db();
  const [objects, decisions, households, members, tasks, progress, attachments] = await Promise.all([
    database.getAll('objects'),
    database.getAll('decisions'),
    database.getAll('households'),
    database.getAll('members'),
    database.getAll('tasks'),
    database.getAll('progress'),
    database.getAll('attachments'),
  ]);

  const withData = await Promise.all(
    attachments.map(async (a) => {
      const bytes = await database.get('files', a.id);
      // Метаданные без содержимого — мусор; пропускаем, чтобы копия не обещала того, чего в ней нет.
      if (!bytes) return null;
      return { ...a, data: toBase64(new Uint8Array(bytes)) };
    }),
  );

  return {
    app: 'life-os',
    schema: CURRENT_SCHEMA,
    exportedAt: now.toISOString(),
    appVersion: __APP_VERSION__,
    objects,
    decisions,
    households,
    members,
    tasks,
    progress,
    attachments: withData.filter((a): a is NonNullable<typeof a> => a !== null),
  };
}

/**
 * Файл резервной копии. С паролем содержимое шифруется (см. backup-crypto.ts) — без него копия
 * с паспортами и медзаписями лежит открытым текстом там, куда её положил пользователь.
 */
export async function backupToBlob(password?: string, now: Date = new Date()): Promise<Blob> {
  const plaintext = JSON.stringify(await buildBackup(now));
  const body = password ? JSON.stringify(await encryptBackup(plaintext, password)) : plaintext;
  return new Blob([body], { type: 'application/json' });
}

const LAST_BACKUP_KEY = 'last-backup-at';
/** Через сколько дней без копии стоит напомнить. Данные лежат в одном месте — молчать нельзя. */
export const backupStaleDays = 30;

/** Отметить, что копия сделана. Вызывается только после реально сохранённого файла. */
export async function rememberBackup(now: Date = new Date()): Promise<void> {
  await setSetting(LAST_BACKUP_KEY, now.toISOString());
}

export async function lastBackupAt(): Promise<string | null> {
  return (await getSetting<string>(LAST_BACKUP_KEY)) ?? null;
}

/** Пора ли напомнить о копии: копии не было вовсе или она старше `backupStaleDays`. */
export function backupIsStale(lastAt: string | null, now: Date = new Date()): boolean {
  if (!lastAt) return true;
  const age = now.getTime() - new Date(lastAt).getTime();
  return age > backupStaleDays * 86_400_000;
}

export class BackupInvalid extends Error {
  constructor() {
    super('Файл не похож на резервную копию Life OS');
  }
}

/** Копия сделана приложением новее этого — читать её нечем, и делать вид, что файл чужой, нельзя. */
export class BackupTooNew extends Error {
  constructor(readonly fileSchema: number) {
    super('Копия сделана более новой версией Life OS. Обновите приложение и попробуйте снова.');
  }
}

/** Копия опознана, но её содержимое не сходится со схемой. */
export class BackupCorrupted extends Error {
  constructor(readonly issue: string) {
    super(`Копия повреждена: ${issue}`);
  }
}

/**
 * Опознание конверта: копия ли это Life OS и какого поколения формата. Содержимое здесь
 * намеренно не проверяется — сначала надо понять, чем его читать.
 */
const envelopeSchema = z.object({ app: z.literal('life-os'), schema: z.number().int() });

/**
 * Читатели по поколениям формата. Появится schema 2 — здесь появится второй читатель, а первый
 * останется: копия, сделанная сегодня, обязана открываться и через год.
 */
const readers: Record<number, (raw: unknown) => Backup> = {
  1(raw) {
    const parsed = backupSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    // Дамп ZodError человеку не поможет: показываем первую претензию с путём до неё.
    const first = parsed.error.issues[0];
    throw new BackupCorrupted(
      first ? `${first.path.join('.') || '(корень)'} — ${first.message}` : 'разбор не удался',
    );
  },
};

/**
 * Разобрать содержимое копии, каким бы поколением формата она ни была.
 *
 * Три исхода вместо прежнего одного: файл вообще не копия, копия из будущего, копия своя, но
 * битая. Раньше человек получал «Файл не похож на резервную копию» и на фотографию кота, и на
 * собственную копию с испорченной датой.
 */
export function readBackup(raw: unknown): Backup {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) throw new BackupInvalid();
  if (envelope.data.schema > CURRENT_SCHEMA) throw new BackupTooNew(envelope.data.schema);

  const reader = readers[envelope.data.schema];
  // Поколения, которого никогда не существовало, — значит, и файл не наш.
  if (!reader) throw new BackupInvalid();
  return reader(raw);
}

/** Копия зашифрована — значит, при импорте нужно спросить пароль. */
export class BackupEncrypted extends Error {
  constructor() {
    super('Копия зашифрована паролем');
  }
}

/**
 * Прочитать и проверить файл копии. Ничего не меняет — только разбирает.
 * Для зашифрованной копии без пароля бросает `BackupEncrypted`, с неверным паролем — `WrongPassword`.
 */
export async function readBackupFile(file: File, password?: string): Promise<Backup> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupInvalid();
  }

  if (isEncryptedBackup(raw)) {
    if (!password) throw new BackupEncrypted();
    raw = JSON.parse(await decryptBackup(raw, password));
  }

  return readBackup(raw);
}

/** Заменить все данные на устройстве содержимым копии. Прежние данные удаляются. */
export async function applyBackup(backup: Backup): Promise<void> {
  const database = await db();

  // Содержимое вложений раскодируется ДО открытия транзакции. Внутри неё бросок из atob оставил бы
  // базу наполовину стёртой: запросы clear() к тому моменту уже выданы и успевают закоммититься.
  // Транзакция открывается, когда раскодировать больше нечего и упасть уже негде.
  const files = backup.attachments.map(({ data, ...meta }) => ({
    meta,
    bytes: fromBase64(data).buffer,
  }));

  const tx = database.transaction(dataStores, 'readwrite');
  const ops: Promise<unknown>[] = dataStores.map((name) => tx.objectStore(name).clear());

  ops.push(...backup.objects.map((o) => tx.objectStore('objects').put(o)));
  ops.push(...backup.decisions.map((d) => tx.objectStore('decisions').put(d)));
  ops.push(...backup.households.map((h) => tx.objectStore('households').put(h)));
  ops.push(...backup.members.map((m) => tx.objectStore('members').put(m)));
  ops.push(...backup.tasks.map((t) => tx.objectStore('tasks').put(t)));
  ops.push(...backup.progress.map((p) => tx.objectStore('progress').put(p)));
  for (const { meta, bytes } of files) {
    ops.push(tx.objectStore('attachments').put(meta));
    ops.push(tx.objectStore('files').put(bytes, meta.id));
  }

  await Promise.all([...ops, tx.done]);
}

/**
 * Страховка перед восстановлением из копии.
 *
 * `applyBackup` стирает всё и заливает файл. Выбрали не тот файл — прежних данных больше нет, а
 * второй копии у локального приложения по определению не существует. Поэтому перед импортом
 * состояние откладывается целиком.
 *
 * Снимок живёт в хранилище `settings`, и это не случайность: ни `applyBackup`, ни `clearAllData`
 * настройки не трогают (они чистят только `dataStores`), поэтому снимок переживает и импорт, и
 * перезагрузку страницы, которой импорт заканчивается.
 */

const ROLLBACK_KEY = 'pre-import-rollback';

/** Больше этого снимок не откладываем: он лёг бы в то же хранилище, которое и так на пределе. */
export const rollbackMaxBytes = 50 * 1024 * 1024;
/** Сколько дней предлагать откат. Дальше решение считается принятым. */
export const rollbackKeepDays = 7;

export interface StashedRollback {
  /** Когда сделан снимок — то есть момент, к которому вернёт откат. */
  at: string;
  backup: Backup;
}

/**
 * Отложить текущее состояние. `false` — данных слишком много, снимок не поместится;
 * интерфейс обязан сказать это прямо, а не делать вид, что откат есть.
 */
export async function stashRollback(now: Date = new Date()): Promise<boolean> {
  const attachments = await (await db()).getAll('attachments');
  // base64 раздувает содержимое на треть — считаем по факту, а не по размеру файлов.
  const estimate = attachments.reduce((sum, a) => sum + a.size, 0) * (4 / 3);
  if (estimate > rollbackMaxBytes) return false;

  await setSetting(ROLLBACK_KEY, { at: now.toISOString(), backup: await buildBackup(now) });
  return true;
}

/** Отложенный снимок, если он есть и ещё не протух. */
export async function takeRollback(now: Date = new Date()): Promise<StashedRollback | null> {
  const stashed = await getSetting<StashedRollback>(ROLLBACK_KEY);
  if (!stashed) return null;
  if (now.getTime() - new Date(stashed.at).getTime() > rollbackKeepDays * 86_400_000) {
    await dropRollback();
    return null;
  }
  return stashed;
}

export async function dropRollback(): Promise<void> {
  await (await db()).delete('settings', ROLLBACK_KEY);
}

/** Вернуть данные к состоянию до импорта и убрать снимок. */
export async function undoImport(now: Date = new Date()): Promise<boolean> {
  const stashed = await takeRollback(now);
  if (!stashed) return false;
  // Снимок сделан прежней версией приложения и проходит ту же проверку, что и файл с диска:
  // ровно так поколение формата поднимается до текущего. Не прошёл — снимок остаётся на месте,
  // а человек видит, что именно не так; молча записать в базу непонятно что было бы хуже.
  await applyBackup(readBackup(stashed.backup));
  await dropRollback();
  return true;
}
