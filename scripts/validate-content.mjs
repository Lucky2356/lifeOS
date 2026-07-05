import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Требует собранный доменный пакет (в CI сборка идёт до валидации).
const { validateContentPack } = require('../packages/domain/dist/index.js');

const packsDir = new URL('../content-packs/', import.meta.url);
const packs = readdirSync(packsDir, { withFileTypes: true }).filter((d) => d.isDirectory());

let ok = 0;
for (const dir of packs) {
  const file = new URL(`../content-packs/${dir.name}/pack.json`, import.meta.url);
  const data = JSON.parse(readFileSync(file, 'utf-8'));
  validateContentPack(data);
  console.log(`content pack "${dir.name}" — valid (${data.playbooks.length} playbooks)`);
  ok += 1;
}

if (ok === 0) {
  console.error('No content packs found');
  process.exit(1);
}
