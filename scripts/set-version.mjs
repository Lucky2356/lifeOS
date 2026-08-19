#!/usr/bin/env node
/**
 * Проставить версию во все места разом: package.json пакетов, Cargo (десктоп), tauri.conf.json и
 * Android-градл. Раньше версии расходились — корень жил в 0.0.0, а оболочки в 0.9.x, и ничто их
 * не связывало.
 *
 *   node scripts/set-version.mjs 1.0.0
 *
 * versionCode для Android выводится из semver: major*10000 + minor*100 + patch — монотонно растёт,
 * а Android требует, чтобы каждое обновление имело код больше предыдущего.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const raw = process.argv[2];
if (!raw) {
  console.error('Укажите версию: node scripts/set-version.mjs 1.0.0');
  process.exit(1);
}
const version = raw.replace(/^v/, '');
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) {
  console.error(`Версия должна быть вида 1.0.0, получено: ${raw}`);
  process.exit(1);
}
const [, major, minor, patch] = match.map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

function edit(relPath, transform) {
  const file = join(root, relPath);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`  = ${relPath} (без изменений)`);
    return;
  }
  writeFileSync(file, after);
  console.log(`  → ${relPath}`);
}

const packageJsons = [
  'package.json',
  'packages/domain/package.json',
  'apps/app/package.json',
  'apps/desktop/package.json',
  'apps/mobile/package.json',
];

console.log(`Версия ${version} (versionCode ${versionCode}):`);

for (const rel of packageJsons) {
  edit(rel, (text) => text.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${version}$2`));
}

edit('apps/desktop/src-tauri/Cargo.toml', (text) =>
  text.replace(/^(version = ")[^"]*(")/m, `$1${version}$2`),
);

edit('apps/desktop/src-tauri/tauri.conf.json', (text) =>
  text.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${version}$2`),
);

// Cargo.lock: версия собственного пакета, чтобы сборка не переписывала lock-файл.
edit('apps/desktop/src-tauri/Cargo.lock', (text) =>
  text.replace(/(name = "life-os-desktop"\nversion = ")[^"]*(")/, `$1${version}$2`),
);

edit('apps/mobile/android/app/build.gradle', (text) =>
  text
    .replace(/versionCode \d+/, `versionCode ${versionCode}`)
    .replace(/versionName "[^"]*"/, `versionName "${version}"`),
);
