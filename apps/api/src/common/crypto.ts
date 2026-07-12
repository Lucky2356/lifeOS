import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Шифрование чувствительных данных в покое (AES-256-GCM) с поддержкой РОТАЦИИ КЛЮЧЕЙ.
 *
 * Keyring строится лениво (после ensureSecrets в bootstrap):
 *  - `ENCRYPTION_KEYS="id1:material1,id2:material2,..."` — упорядоченный набор; ПЕРВЫЙ ключ текущий
 *    (им шифруются новые данные), остальные — прежние (для расшифровки старых записей по их keyId).
 *  - если `ENCRYPTION_KEYS` не задан — берём одиночный `ENCRYPTION_KEY` (или per-install из app_secrets)
 *    под id `v1` (нулевая настройка, обратная совместимость).
 * Записи, зашифрованные ДО введения keyId (нет id ни в строке, ни в БД), расшифровываются САМЫМ СТАРЫМ
 * (последним) ключом — при ротации оператор кладёт прежний ключ последним, и легаси-данные читаются.
 * Идентификаторы ключей — из [A-Za-z0-9_-] (точка зарезервирована как разделитель в строковом формате).
 */
type Keyring = { current: string; keys: Map<string, Buffer>; oldestId: string };
let cached: Keyring | null = null;

function deriveKey(material: string): Buffer {
  return createHash('sha256').update(material).digest();
}

function keyring(): Keyring {
  if (cached) return cached;
  const raw = process.env.ENCRYPTION_KEYS?.trim();
  const keys = new Map<string, Buffer>();
  let order: string[] = [];
  if (raw) {
    for (const pair of raw.split(',')) {
      const idx = pair.indexOf(':');
      if (idx < 0) continue;
      const id = pair.slice(0, idx).trim();
      const material = pair.slice(idx + 1);
      if (!/^[A-Za-z0-9_-]+$/.test(id) || !material) continue;
      keys.set(id, deriveKey(material));
      order.push(id);
    }
  }
  if (keys.size === 0) {
    // Обратная совместимость: одиночный ключ под id v1.
    keys.set('v1', deriveKey(process.env.ENCRYPTION_KEY || 'dev-insecure-key-change-me'));
    order = ['v1'];
  }
  const ring: Keyring = { current: order[0]!, keys, oldestId: order[order.length - 1]! };
  cached = ring;
  return ring;
}

/** Тестовый хук: сбросить кэш keyring (после подмены process.env). */
export function _resetKeyringForTest(): void {
  cached = null;
}

/** Идентификатор текущего ключа — сохраняйте его рядом с зашифрованными бинарными данными (файлы). */
export function currentKeyId(): string {
  return keyring().current;
}

function keyFor(id: string | null | undefined): Buffer {
  const ring = keyring();
  const key = ring.keys.get(id ?? ring.oldestId); // нет id → легаси → самый старый ключ
  if (!key) throw new Error(`Нет ключа шифрования с id=${id}`);
  return key;
}

export function encryptSecret(plain: string): string {
  const ring = keyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ring.keys.get(ring.current)!, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Формат v2: keyId.iv.tag.data (4 части). Легаси-формат iv.tag.data (3 части) — читается старым ключом.
  return [ring.current, iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  const [keyId, ivB, tagB, dataB] = parts.length === 4 ? parts : [null, ...parts];
  if (!ivB || !tagB || !dataB) throw new Error('Invalid ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(keyId), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Шифрование бинарных данных (файлы) текущим ключом. Формат: iv(12) | tag(16) | ciphertext.
 * keyId в файл НЕ пишем (неоднозначный разбор префикса) — храните `currentKeyId()` в БД рядом с записью.
 */
export function encryptBuffer(plain: Buffer): Buffer {
  const ring = keyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ring.keys.get(ring.current)!, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

/** Расшифровка бинарных данных ключом с указанным keyId (из БД). null/undefined → легаси (старый ключ). */
export function decryptBuffer(payload: Buffer, keyId?: string | null): Buffer {
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyFor(keyId), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
