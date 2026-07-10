import { z } from 'zod';
import { sensitivitySchema } from './life-object';

/** Метаданные вложения к объекту реестра. Сам файл хранится зашифрованным на сервере. */
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

/** Разрешённые типы файлов и лимит размера — единый источник правды для клиента и сервера. */
export const allowedAttachmentMimes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;
export const maxAttachmentBytes = 10 * 1024 * 1024; // 10 МБ
