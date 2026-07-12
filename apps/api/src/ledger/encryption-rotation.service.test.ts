import { describe, it, expect } from 'vitest';
import { EncryptionRotationService } from './encryption-rotation.service';
import { InMemoryAttachmentRepository } from './attachment.repository';
import type { AttachmentStorage } from './attachment-storage';
import { InMemoryUserRepository, type User } from '../iam/user.repository';
import { currentKeyId, decryptSecret, encryptSecret } from '../common/crypto';
import type { Attachment } from '@life-os/domain';

function mkUser(over: Partial<User> = {}): User {
  return {
    id: '00000000-0000-0000-0000-0000000000a1',
    email: 'a@b.co',
    passwordHash: 'x',
    mfaEnabled: true,
    mfaSecretEnc: null,
    status: 'active',
    locale: 'ru',
    createdAt: new Date().toISOString(),
    notifyEmail: true,
    ...over,
  };
}

function mkAttachment(over: Partial<Attachment> = {}): Attachment {
  return {
    id: '11111111-1111-7111-8111-111111111111',
    objectId: '22222222-2222-7222-8222-222222222222',
    ownerUserId: '00000000-0000-0000-0000-0000000000a1',
    filename: 'scan.png',
    mime: 'image/png',
    size: 4,
    sensitivity: 'high',
    encryptionKeyId: 'legacy-old',
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe('EncryptionRotationService', () => {
  it('перешифровывает MFA-секреты и вложения на текущий ключ', async () => {
    const users = new InMemoryUserRepository();
    const attachments = new InMemoryAttachmentRepository();
    const mem = new Map<string, Buffer>();
    const storage = {
      save: async (id: string, b: Buffer) => void mem.set(id, b),
      load: async (id: string) => mem.get(id) ?? Buffer.alloc(0),
      remove: async (id: string) => void mem.delete(id),
    } as unknown as AttachmentStorage;

    await users.create(mkUser({ mfaSecretEnc: encryptSecret('JBSWY3DPEHPK3PXP') }));
    const att = mkAttachment();
    await attachments.create(att);
    mem.set(att.id, Buffer.from('file-bytes'));

    const service = new EncryptionRotationService(users, attachments, storage);
    const res = await service.run();

    expect(res.mfaSecrets).toBe(1);
    expect(res.attachments).toBe(1);

    // MFA-секрет по-прежнему расшифровывается в исходное значение.
    const u = await users.findById('00000000-0000-0000-0000-0000000000a1');
    expect(decryptSecret(u!.mfaSecretEnc!)).toBe('JBSWY3DPEHPK3PXP');

    // keyId вложения обновлён на текущий; повторный прогон его пропускает.
    const [updated] = await attachments.listAll();
    expect(updated.encryptionKeyId).toBe(currentKeyId());
    const second = await service.run();
    expect(second.attachments).toBe(0);
  });
});
