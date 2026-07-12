import { Injectable } from '@nestjs/common';
import type { Attachment } from '@life-os/domain';

export interface AttachmentRepository {
  create(a: Attachment): Promise<Attachment>;
  listByObject(objectId: string, ownerUserId: string): Promise<Attachment[]>;
  findById(id: string, ownerUserId: string): Promise<Attachment | null>;
  delete(id: string, ownerUserId: string): Promise<boolean>;
  /** Удалить все вложения объекта; возвращает id удалённых (чтобы стереть файлы с диска). */
  deleteByObject(objectId: string): Promise<string[]>;
  /** Удалить все вложения владельца (право на забвение); возвращает id удалённых. */
  deleteByOwner(ownerUserId: string): Promise<string[]>;
}

export const ATTACHMENT_REPOSITORY = Symbol('ATTACHMENT_REPOSITORY');

@Injectable()
export class InMemoryAttachmentRepository implements AttachmentRepository {
  private readonly store = new Map<string, Attachment>();

  async create(a: Attachment): Promise<Attachment> {
    this.store.set(a.id, a);
    return a;
  }

  async listByObject(objectId: string, ownerUserId: string): Promise<Attachment[]> {
    return [...this.store.values()]
      .filter((a) => a.objectId === objectId && a.ownerUserId === ownerUserId)
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  }

  async findById(id: string, ownerUserId: string): Promise<Attachment | null> {
    const a = this.store.get(id);
    return a && a.ownerUserId === ownerUserId ? a : null;
  }

  async delete(id: string, ownerUserId: string): Promise<boolean> {
    const a = this.store.get(id);
    if (!a || a.ownerUserId !== ownerUserId) return false;
    this.store.delete(id);
    return true;
  }

  async deleteByObject(objectId: string): Promise<string[]> {
    const ids = [...this.store.values()].filter((a) => a.objectId === objectId).map((a) => a.id);
    ids.forEach((id) => this.store.delete(id));
    return ids;
  }

  async deleteByOwner(ownerUserId: string): Promise<string[]> {
    const ids = [...this.store.values()].filter((a) => a.ownerUserId === ownerUserId).map((a) => a.id);
    ids.forEach((id) => this.store.delete(id));
    return ids;
  }
}
