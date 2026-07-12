import { describe, it, expect, afterEach } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  encryptBuffer,
  decryptBuffer,
  currentKeyId,
  _resetKeyringForTest,
} from './crypto';

/** Выполнить fn с временным keyring из ENCRYPTION_KEYS. */
function withKeys<T>(spec: string, fn: () => T): T {
  const prev = process.env.ENCRYPTION_KEYS;
  process.env.ENCRYPTION_KEYS = spec;
  _resetKeyringForTest();
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.ENCRYPTION_KEYS;
    else process.env.ENCRYPTION_KEYS = prev;
    _resetKeyringForTest();
  }
}

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

describe('crypto — ротация ключей (keyring)', () => {
  afterEach(() => _resetKeyringForTest());

  it('новые данные шифруются ТЕКУЩИМ (первым) ключом', () => {
    withKeys('v2:new-material,v1:old-material', () => {
      expect(currentKeyId()).toBe('v2');
      const c = encryptSecret('x');
      expect(c.startsWith('v2.')).toBe(true);
      expect(decryptSecret(c)).toBe('x');
    });
  });

  it('данные, зашифрованные прежним ключом, читаются после ротации (строка)', () => {
    const old = withKeys('v1:old-material', () => encryptSecret('секрет'));
    const dec = withKeys('v2:new-material,v1:old-material', () => decryptSecret(old));
    expect(dec).toBe('секрет');
  });

  it('легаси-строка без keyId (3 части) читается самым старым ключом', () => {
    const four = withKeys('legacy:old-material', () => encryptSecret('старое'));
    const threePart = four.split('.').slice(1).join('.'); // убираем keyId-префикс
    const dec = withKeys('v2:new-material,legacy0:old-material', () => decryptSecret(threePart));
    expect(dec).toBe('старое');
  });

  it('бинарные данные: старый keyId и легаси (без id) читаются после ротации', () => {
    const buf = withKeys('v1:old-material', () => encryptBuffer(Buffer.from('файл')));
    withKeys('v2:new-material,v1:old-material', () => {
      expect(decryptBuffer(buf, 'v1').toString()).toBe('файл'); // по явному keyId
      expect(decryptBuffer(buf).toString()).toBe('файл'); // без id → самый старый (v1)
    });
  });
});
