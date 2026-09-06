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
  try {
    validateContentPack(data);
  } catch (error) {
    // Дамп ZodError в логе CI читать невозможно: печатаем путь и суть каждой претензии.
    console.error(`content pack "${dir.name}" — invalid:`);
    for (const issue of error.issues ?? [{ path: [], message: String(error) }]) {
      console.error(`  ${issue.path.join('.') || '(корень)'}: ${issue.message}`);
    }
    process.exit(1);
  }
  // Объём пака виден в логе CI: по нему сразу заметно, что контент случайно не уехал.
  const steps = data.playbooks.reduce((n, p) => n + p.steps.length, 0);
  const guides = data.playbooks.flatMap((p) => p.steps.filter((s) => s.embedsGuideKey)).length;
  console.log(
    `content pack "${dir.name}" — valid (${data.playbooks.length} playbooks, ${steps} steps, ${guides} embedded guides)`,
  );
  ok += 1;
}

if (ok === 0) {
  console.error('No content packs found');
  process.exit(1);
}
