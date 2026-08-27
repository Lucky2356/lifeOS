import { describe, it, expect } from 'vitest';
import { decryptBackup, encryptBackup, isEncryptedBackup, WrongPassword } from './backup-crypto';

describe('шифрование резервной копии', () => {
  const secret = 'номер паспорта 75 1234567, диагноз, сумма ипотеки';

  it('расшифровывается тем же паролем', async () => {
    const box = await encryptBackup(secret, 'верный-пароль');
    expect(await decryptBackup(box, 'верный-пароль')).toBe(secret);
  });

  it('исходный текст не виден в зашифрованном файле', async () => {
    const box = await encryptBackup(secret, 'пароль');
    expect(JSON.stringify(box)).not.toContain('паспорт');
    expect(JSON.stringify(box)).not.toContain(secret);
  });

  it('неверный пароль отклоняется', async () => {
    const box = await encryptBackup(secret, 'правильный');
    await expect(decryptBackup(box, 'неправильный')).rejects.toThrow(WrongPassword);
  });

  it('подмена данных обнаруживается', async () => {
    const box = await encryptBackup(secret, 'пароль');
    const tampered = { ...box, data: `${box.data.slice(0, -4)}AAAA` };
    await expect(decryptBackup(tampered, 'пароль')).rejects.toThrow(WrongPassword);
  });

  it('каждое шифрование даёт свою соль и вектор', async () => {
    const a = await encryptBackup(secret, 'пароль');
    const b = await encryptBackup(secret, 'пароль');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('зашифрованная копия распознаётся, обычная — нет', async () => {
    expect(isEncryptedBackup(await encryptBackup(secret, 'п'))).toBe(true);
    expect(isEncryptedBackup({ app: 'life-os', schema: 1 })).toBe(false);
    expect(isEncryptedBackup(null)).toBe(false);
  });
});
