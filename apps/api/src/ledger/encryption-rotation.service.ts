import { Inject, Injectable } from '@nestjs/common';
import { currentKeyId, decryptSecret, encryptSecret } from '../common/crypto';
import { USER_REPOSITORY, type UserRepository } from '../iam/user.repository';
import { AttachmentStorage } from './attachment-storage';
import { ATTACHMENT_REPOSITORY, type AttachmentRepository } from './attachment.repository';

/**
 * Ротация ключей шифрования: перешифровывает существующие данные (MFA-секреты, файлы вложений) на
 * ТЕКУЩИЙ ключ keyring и обновляет их keyId. Запускается после добавления нового ключа первым в
 * `ENCRYPTION_KEYS`. Идемпотентно: вложения с актуальным keyId пропускаются.
 */
@Injectable()
export class EncryptionRotationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ATTACHMENT_REPOSITORY) private readonly attachments: AttachmentRepository,
    private readonly storage: AttachmentStorage,
  ) {}

  async run(): Promise<{ mfaSecrets: number; attachments: number }> {
    const current = currentKeyId();

    // MFA-секреты хранят keyId внутри строки; перешифровываем все в текущий ключ.
    let mfaSecrets = 0;
    for (const u of await this.users.listWithMfaSecret()) {
      if (!u.mfaSecretEnc) continue;
      u.mfaSecretEnc = encryptSecret(decryptSecret(u.mfaSecretEnc));
      await this.users.save(u);
      mfaSecrets += 1;
    }

    // Файлы вложений: перешифровываем только те, чей keyId отличается от текущего.
    let attachments = 0;
    for (const a of await this.attachments.listAll()) {
      if (a.encryptionKeyId === current) continue;
      const buf = await this.storage.load(a.id, a.encryptionKeyId); // старым ключом
      await this.storage.save(a.id, buf); // save шифрует текущим ключом
      await this.attachments.setKeyId(a.id, current);
      attachments += 1;
    }

    return { mfaSecrets, attachments };
  }
}
