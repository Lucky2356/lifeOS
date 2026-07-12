import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, encryptBuffer, decryptBuffer } from './crypto';

describe('crypto (ленивый ключ шифрования)', () => {
  it('строковый секрет шифруется и дешифруется в исходное значение', () => {
    const plain = 'JBSWY3DPEHPK3PXP'; // напр. base32 TOTP-секрет
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain); // на выходе не открытый текст
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('бинарные данные шифруются и дешифруются байт-в-байт', () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 255, 42]);
    const enc = encryptBuffer(buf);
    expect(enc.equals(buf)).toBe(false); // зашифровано
    expect(decryptBuffer(enc).equals(buf)).toBe(true);
  });

  it('подделка тега аутентификации отвергается (GCM)', () => {
    const enc = encryptBuffer(Buffer.from('секрет'));
    enc[14] ^= 0xff; // портим tag
    expect(() => decryptBuffer(enc)).toThrow();
  });
});
