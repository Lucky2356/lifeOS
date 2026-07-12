import { and, eq } from 'drizzle-orm';
import { attachmentSchema, type Attachment } from '@life-os/domain';
import type { Database } from '../db/drizzle.provider';
import { attachments } from '../db/schema';
import type { AttachmentRepository } from './attachment.repository';

export class DrizzleAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Database) {}

  async create(a: Attachment): Promise<Attachment> {
    await this.db.insert(attachments).values(a);
    return a;
  }

  async listByObject(objectId: string, ownerUserId: string): Promise<Attachment[]> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.objectId, objectId), eq(attachments.ownerUserId, ownerUserId)));
    return rows.map((r) => attachmentSchema.parse(r));
  }

  async findById(id: string, ownerUserId: string): Promise<Attachment | null> {
    const rows = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.ownerUserId, ownerUserId)))
      .limit(1);
    return rows[0] ? attachmentSchema.parse(rows[0]) : null;
  }

  async delete(id: string, ownerUserId: string): Promise<boolean> {
    const rows = await this.db
      .delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.ownerUserId, ownerUserId)))
      .returning({ id: attachments.id });
    return rows.length > 0;
  }

  async deleteByObject(objectId: string): Promise<string[]> {
    const rows = await this.db
      .delete(attachments)
      .where(eq(attachments.objectId, objectId))
      .returning({ id: attachments.id });
    return rows.map((r) => r.id);
  }

  async deleteByOwner(ownerUserId: string): Promise<string[]> {
    const rows = await this.db
      .delete(attachments)
      .where(eq(attachments.ownerUserId, ownerUserId))
      .returning({ id: attachments.id });
    return rows.map((r) => r.id);
  }
}
