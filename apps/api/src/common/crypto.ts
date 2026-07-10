import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Шифрование чувствительных секретов в покое (AES-256-GCM). Ключ — из ENCRYPTION_KEY (KMS в prod). */
const keyMaterial = process.env.ENCRYPTION_KEY ?? 'dev-insecure-key-change-me';
const key = createHash('sha256').update(keyMaterial).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.');
  if (!ivB || !tagB || !dataB) throw new Error('Invalid ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Шифрование бинарных данных (файлы) AES-256-GCM. Формат: iv(12) | tag(16) | ciphertext. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
