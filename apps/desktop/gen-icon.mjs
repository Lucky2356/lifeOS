import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

/**
 * Генерирует исходную иконку 512×512 (RGBA PNG) в фирменных цветах Life OS без внешних зависимостей.
 * Из неё Tauri (`tauri icon`) создаёт все платформенные иконки (.ico/.icns/png).
 * Фон — шалфей #3A6455, в центре — светлый круг («спокойная точка опоры»).
 */
const SIZE = 512;
const bg = [0x3a, 0x64, 0x55];
const fg = [0xf3, 0xf0, 0xe9];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const cx = SIZE / 2;
const cy = SIZE / 2;
const r = SIZE * 0.3;
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    const c = inCircle ? fg : bg;
    const p = rowStart + 1 + x * 4;
    raw[p] = c[0];
    raw[p + 1] = c[1];
    raw[p + 2] = c[2];
    raw[p + 3] = 0xff;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(new URL('./', import.meta.url), { recursive: true });
writeFileSync(new URL('./app-icon.png', import.meta.url), png);
console.log('app-icon.png готова:', png.length, 'байт');
