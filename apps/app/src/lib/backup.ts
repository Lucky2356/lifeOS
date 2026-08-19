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
import { db, dataStores } from './store/db';

/**
 * Резервная копия — единственный способ вынести данные с устройства (ADR 0006). Сервера нет,
 * поэтому снос приложения без бэкапа означает потерю всего: экспорт здесь не удобство, а страховка.
 *
 * Формат — один JSON: записи как есть плюс содержимое файлов в base64. Читаемо, без зависимостей
 * на архиватор, переносится между устройствами и платформами.
 */

const CURRENT_SCHEMA = 1;

const backupAttachmentSchema = attachmentSchema.extend({
  /** Содержимое файла в base64. */
  data: z.string(),
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

export async function backupToBlob(now: Date = new Date()): Promise<Blob> {
  const backup = await buildBackup(now);
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export class BackupInvalid extends Error {
  constructor() {
    super('Файл не похож на резервную копию Life OS');
  }
}

/** Прочитать и проверить файл копии. Ничего не меняет — только разбирает. */
export async function readBackupFile(file: File): Promise<Backup> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupInvalid();
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new BackupInvalid();
  return parsed.data;
}

/** Заменить все данные на устройстве содержимым копии. Прежние данные удаляются. */
export async function applyBackup(backup: Backup): Promise<void> {
  const database = await db();
  const tx = database.transaction(dataStores, 'readwrite');
  const ops: Promise<unknown>[] = dataStores.map((name) => tx.objectStore(name).clear());

  ops.push(...backup.objects.map((o) => tx.objectStore('objects').put(o)));
  ops.push(...backup.decisions.map((d) => tx.objectStore('decisions').put(d)));
  ops.push(...backup.households.map((h) => tx.objectStore('households').put(h)));
  ops.push(...backup.members.map((m) => tx.objectStore('members').put(m)));
  ops.push(...backup.tasks.map((t) => tx.objectStore('tasks').put(t)));
  ops.push(...backup.progress.map((p) => tx.objectStore('progress').put(p)));
  for (const { data, ...meta } of backup.attachments) {
    ops.push(tx.objectStore('attachments').put(meta));
    ops.push(tx.objectStore('files').put(fromBase64(data).buffer, meta.id));
  }

  await Promise.all([...ops, tx.done]);
}
