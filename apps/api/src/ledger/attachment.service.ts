import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { maxAttachmentBytes, newId, sniffAttachmentMime, type Attachment } from '@life-os/domain';
import { currentKeyId } from '../common/crypto';
import { LifeObjectService } from './life-object.service';
import { AttachmentStorage } from './attachment-storage';
import { ATTACHMENT_REPOSITORY, type AttachmentRepository } from './attachment.repository';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentService {
  constructor(
    @Inject(ATTACHMENT_REPOSITORY) private readonly repo: AttachmentRepository,
    private readonly storage: AttachmentStorage,
    private readonly objects: LifeObjectService,
  ) {}

  async upload(objectId: string, ownerUserId: string, file?: UploadedFile): Promise<Attachment> {
    const obj = await this.objects.get(objectId, ownerUserId); // бросит NotFound, если не владелец
    if (!file) throw new BadRequestException('Файл не передан');
    if (file.size > maxAttachmentBytes) throw new PayloadTooLargeException('Файл больше 10 МБ');
    // Тип определяем по СОДЕРЖИМОМУ (магические байты), не доверяя MIME от клиента.
    const detected = sniffAttachmentMime(file.buffer);
    if (!detected) {
      throw new BadRequestException('Недопустимый тип файла (PDF или изображение)');
    }

    const attachment: Attachment = {
      id: newId(),
      objectId,
      ownerUserId,
      filename: file.originalname.slice(0, 255),
      mime: detected,
      size: file.size,
      sensitivity: obj.sensitivity,
      encryptionKeyId: currentKeyId(), // фиксируем, каким ключом зашифрован файл (для ротации)
      createdAt: new Date().toISOString(),
    };
    await this.storage.save(attachment.id, file.buffer);
    return this.repo.create(attachment);
  }

  list(objectId: string, ownerUserId: string): Promise<Attachment[]> {
    return this.repo.listByObject(objectId, ownerUserId);
  }

  async download(id: string, ownerUserId: string): Promise<{ meta: Attachment; content: Buffer }> {
    const meta = await this.repo.findById(id, ownerUserId);
    if (!meta) throw new NotFoundException('Вложение не найдено');
    return { meta, content: await this.storage.load(id, meta.encryptionKeyId) };
  }

  async remove(id: string, ownerUserId: string): Promise<void> {
    const meta = await this.repo.findById(id, ownerUserId);
    if (!meta) throw new NotFoundException('Вложение не найдено');
    await this.storage.remove(id);
    await this.repo.delete(id, ownerUserId);
  }

  /** Каскад при удалении объекта: стереть все его вложения (файлы с диска + записи). */
  async removeForObject(objectId: string): Promise<void> {
    const ids = await this.repo.deleteByObject(objectId);
    await Promise.all(ids.map((id) => this.storage.remove(id)));
  }

  /** Каскад при «праве на забвение»: стереть все вложения владельца. */
  async removeAllForOwner(ownerUserId: string): Promise<void> {
    const ids = await this.repo.deleteByOwner(ownerUserId);
    await Promise.all(ids.map((id) => this.storage.remove(id)));
  }
}
