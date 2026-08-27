import { maxAttachmentBytes, newId, sniffAttachmentMime, type Attachment } from '@life-os/domain';
import { db } from './db';
import { ownerUserId } from './local-user';

/**
 * Вложения (сканы, PDF) на устройстве: метаданные — в хранилище `attachments`, байты файла —
 * в `files` под тем же id. Шифрования нет и быть не может: без пароля пользователя ключ пришлось бы
 * держать рядом с данными. Защита — песочница приложения и шифрование диска ОС (см. docs/SECURITY.md).
 */

/** Коды ошибок для понятных сообщений в интерфейсе. */
export type AttachmentError = 'too-large' | 'unsupported' | 'not-found' | 'no-space';

export class AttachmentFailure extends Error {
  constructor(public readonly code: AttachmentError) {
    super(code);
  }
}

/** Первых байт хватает всем поддерживаемым форматам (HEIC читает бренд по смещению 8..12). */
const SNIFF_BYTES = 16;

export const attachmentsStore = {
  async list(objectId: string): Promise<Attachment[]> {
    const all = await (await db()).getAllFromIndex('attachments', 'by-object', objectId);
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** Добавить файл к объекту. Тип проверяется по содержимому, а не по расширению. */
  async add(objectId: string, file: File): Promise<Attachment> {
    if (file.size > maxAttachmentBytes) throw new AttachmentFailure('too-large');

    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    const mime = sniffAttachmentMime(head);
    if (!mime) throw new AttachmentFailure('unsupported');

    const database = await db();
    const parent = await database.get('objects', objectId);
    if (!parent) throw new AttachmentFailure('not-found');

    const attachment: Attachment = {
      id: newId(),
      objectId,
      ownerUserId: await ownerUserId(),
      filename: file.name.slice(0, 255),
      mime,
      size: file.size,
      // Чувствительность наследуется от документа: скан паспорта не менее чувствителен, чем сам паспорт.
      sensitivity: parent.sensitivity,
      createdAt: new Date().toISOString(),
    };

    const bytes = await file.arrayBuffer();
    try {
      const tx = database.transaction(['attachments', 'files'], 'readwrite');
      await Promise.all([
        tx.objectStore('attachments').put(attachment),
        tx.objectStore('files').put(bytes, attachment.id),
        tx.done,
      ]);
    } catch (err) {
      // Кончилось место на устройстве — это не «что-то пошло не так», и сказать надо прямо.
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new AttachmentFailure('no-space');
      }
      throw err;
    }
    return attachment;
  },

  /** Метаданные вместе с содержимым — для просмотра и для резервной копии. */
  async read(id: string): Promise<{ meta: Attachment; bytes: ArrayBuffer }> {
    const database = await db();
    const [meta, bytes] = await Promise.all([database.get('attachments', id), database.get('files', id)]);
    if (!meta || !bytes) throw new AttachmentFailure('not-found');
    return { meta, bytes };
  },

  async remove(id: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['attachments', 'files'], 'readwrite');
    await Promise.all([
      tx.objectStore('attachments').delete(id),
      tx.objectStore('files').delete(id),
      tx.done,
    ]);
  },
};
