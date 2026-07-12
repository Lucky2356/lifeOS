import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { decryptBuffer, encryptBuffer } from '../common/crypto';

/**
 * Хранилище файлов вложений на диске сервера, зашифрованных AES-256-GCM (тем же ключом, что и секреты).
 * Путь — из ATTACHMENTS_DIR (в проде — том Docker). Имя файла = id вложения.
 */
@Injectable()
export class AttachmentStorage {
  private readonly dir = process.env.ATTACHMENTS_DIR ?? resolve(process.cwd(), 'attachments-data');

  async save(id: string, content: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, id), encryptBuffer(content));
  }

  async load(id: string, keyId?: string | null): Promise<Buffer> {
    return decryptBuffer(await readFile(join(this.dir, id)), keyId);
  }

  async remove(id: string): Promise<void> {
    await unlink(join(this.dir, id)).catch(() => {});
  }
}
