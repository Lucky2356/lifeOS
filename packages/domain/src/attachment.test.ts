import { describe, it, expect } from 'vitest';
import { sniffAttachmentMime } from './attachment';

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
/** Записать ASCII-строку в буфер по смещению. */
const put = (buf: Uint8Array, offset: number, s: string) => {
  for (let i = 0; i < s.length; i++) buf[offset + i] = s.charCodeAt(i);
};

describe('sniffAttachmentMime', () => {
  it('распознаёт разрешённые типы по магическим байтам', () => {
    expect(sniffAttachmentMime(bytes(0x25, 0x50, 0x44, 0x46))).toBe('application/pdf');
    expect(sniffAttachmentMime(bytes(0xff, 0xd8, 0xff, 0x00))).toBe('image/jpeg');
    expect(sniffAttachmentMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  });

  it('распознаёт WEBP (RIFF....WEBP)', () => {
    const b = new Uint8Array(12);
    put(b, 0, 'RIFF');
    put(b, 8, 'WEBP');
    expect(sniffAttachmentMime(b)).toBe('image/webp');
  });

  it('распознаёт HEIC по ftyp + бренду', () => {
    const b = new Uint8Array(12);
    put(b, 4, 'ftyp');
    put(b, 8, 'heic');
    expect(sniffAttachmentMime(b)).toBe('image/heic');
  });

  it('возвращает null для неизвестного/текстового содержимого', () => {
    expect(sniffAttachmentMime(ascii('<html>'))).toBeNull();
    expect(sniffAttachmentMime(bytes(7, 7, 7, 7))).toBeNull();
  });
});
