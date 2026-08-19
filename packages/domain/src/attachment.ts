import { z } from 'zod';
import { sensitivitySchema } from './life-object';

/** Метаданные вложения к объекту реестра. Сам файл лежит рядом, в IndexedDB (ADR 0006). */
export const attachmentSchema = z.object({
  id: z.string().uuid(),
  objectId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mime: z.string().max(150),
  size: z.number().int().nonnegative(),
  sensitivity: sensitivitySchema,
  createdAt: z.string().datetime(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** Разрешённые типы файлов и лимит размера вложения. */
export const allowedAttachmentMimes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export const maxAttachmentBytes = 25 * 1024 * 1024; // 25 МБ

export type AllowedAttachmentMime = (typeof allowedAttachmentMimes)[number];

const startsWith = (b: Uint8Array, sig: number[], offset = 0): boolean =>
  sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, offset: number, s: string): boolean =>
  startsWith(
    b,
    [...s].map((c) => c.charCodeAt(0)),
    offset,
  );

/**
 * Определяет тип файла по «магическим байтам» содержимого — не доверяя расширению и MIME,
 * которые сообщает система. Возвращает распознанный разрешённый MIME или null.
 */
export function sniffAttachmentMime(bytes: Uint8Array): AllowedAttachmentMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return 'image/webp';
  // HEIC: ISO-BMFF box 'ftyp' по смещению 4 + один из HEIF-брендов.
  if (ascii(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}
