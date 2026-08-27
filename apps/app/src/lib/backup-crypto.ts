/**
 * Шифрование резервной копии паролем.
 *
 * Копия — единственный способ вынести данные с устройства, и она содержит всё: номера документов,
 * медицинские записи, суммы. На Android файл уходит через системное «Поделиться», то есть попадает
 * в мессенджер или облако. Пароль здесь — не украшение, а то, что делает такой файл безопасным.
 *
 * PBKDF2-SHA256 (600 000 итераций, как рекомендует OWASP на 2023+) выводит ключ, AES-256-GCM
 * шифрует содержимое и сам же проверяет целостность: подменённый или битый файл не расшифруется.
 * Всё — через WebCrypto, без единой сторонней зависимости.
 */

const MAGIC = 'LIFEOS-ENC1';
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedBackup {
  format: typeof MAGIC;
  iterations: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
  /** base64 шифротекста вместе с тегом GCM */
  data: string;
}

export class WrongPassword extends Error {
  constructor() {
    super('Неверный пароль или файл повреждён');
  }
}

function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let raw = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(raw);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Похоже ли содержимое файла на зашифрованную копию. */
export function isEncryptedBackup(raw: unknown): raw is EncryptedBackup {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { format?: unknown }).format === MAGIC &&
    typeof (raw as { data?: unknown }).data === 'string'
  );
}

export async function encryptBackup(plaintext: string, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, ITERATIONS);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    format: MAGIC,
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackup(backup: EncryptedBackup, password: string): Promise<string> {
  const key = await deriveKey(password, fromBase64(backup.salt), backup.iterations ?? ITERATIONS);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(backup.iv) as BufferSource },
      key,
      fromBase64(backup.data) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // GCM не отличает неверный пароль от испорченного файла — и то и другое проваливает проверку тега.
    throw new WrongPassword();
  }
}
