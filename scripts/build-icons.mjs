#!/usr/bin/env node
/**
 * Собирает используемые иконки Tabler в один TSX-модуль.
 *
 *   node scripts/build-icons.mjs
 *
 * Зачем: раньше приложение тянуло весь веб-шрифт Tabler — 4,4 МБ в трёх форматах и 5807 правил CSS
 * ради 34 иконок, то есть около 79% веса сборки. Здесь имена иконок вычитываются прямо из исходников
 * (`ti-*`), их контуры берутся из пакета @tabler/icons и попадают в код как обычный компонент.
 *
 * Результат коммитится: @tabler/icons нужен только для пересборки этого файла, в зависимостях
 * приложения его нет.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'apps/app/src');
const outFile = join(srcDir, 'components/icon-paths.ts');

/** Каталог с контурами. Лежит в pnpm-store, поэтому ищем по шаблону. */
function findIconsDir() {
  const pnpmDir = join(root, 'node_modules/.pnpm');
  const match = readdirSync(pnpmDir).find((d) => d.startsWith('@tabler+icons@'));
  if (!match) {
    throw new Error('Не найден пакет @tabler/icons — установите его для пересборки иконок');
  }
  return join(pnpmDir, match, 'node_modules/@tabler/icons/icons/outline');
}

/**
 * Список используемых иконок. Держится явно, а не вычитывается из кода: имена приходят и из
 * разметки, и из справочников (`lib/object-visuals.ts`, `iconFor` во вложениях), и из тернарных
 * выражений — надёжного способа собрать их автоматически нет. Ниже стоит проверка, которая не даст
 * забыть добавить иконку: она сверяет список с литералами `<Icon name="..." />` в исходниках.
 */
const usedIcons = [
  'arrow-left',
  'bell',
  'bell-ringing',
  'building',
  'building-bank',
  'car',
  'check',
  'compass',
  'download',
  'edit',
  'file',
  'file-invoice',
  'file-text',
  'file-type-pdf',
  'folders',
  'heartbeat',
  'home',
  'id',
  'info-circle',
  'inner-shadow-top-left',
  'lock',
  'lock-open',
  'moon',
  'photo',
  'plus',
  'repeat',
  'scale',
  'search',
  'settings',
  'shield-check',
  'star',
  'sun',
  'trash',
  'upload',
  'user-plus',
];

/** Литералы `<Icon name="foo" />` в исходниках — чтобы список выше не отставал от разметки. */
function literalIconNames(dir, found = new Set()) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      literalIconNames(full, found);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || entry.includes('.test.')) continue;
    for (const m of readFileSync(full, 'utf8').matchAll(/<Icon\s+name="([a-z0-9-]+)"/g)) {
      found.add(m[1]);
    }
  }
  return found;
}

/**
 * Вытаскивает из svg только рисующие контуры: первый path — прозрачная подложка 24×24,
 * она не нужна, размер задаётся через viewBox.
 */
function extractPaths(svg) {
  return [...svg.matchAll(/<path\s+([^>]*?)\/>/g)]
    .map((m) => m[1])
    .filter((attrs) => !attrs.includes('fill="none"') || !attrs.includes('stroke="none"'))
    .map((attrs) => /(?:^|\s)d="([^"]+)"/.exec(attrs)?.[1])
    .filter((d) => Boolean(d) && d !== 'M0 0h24v24H0z');
}

const iconsDir = findIconsDir();
const names = [...usedIcons].sort();

const missing = [...literalIconNames(srcDir)].filter((n) => !names.includes(n));
if (missing.length > 0) {
  throw new Error(`Иконки есть в разметке, но не в списке usedIcons: ${missing.join(', ')}`);
}

const entries = names.map((name) => {
  const file = join(iconsDir, `${name}.svg`);
  const paths = extractPaths(readFileSync(file, 'utf8'));
  if (paths.length === 0) throw new Error(`У иконки ${name} не нашлось контуров`);
  return `  '${name}': ${JSON.stringify(paths)},`;
});

const out = `// Файл сгенерирован: node scripts/build-icons.mjs — правки вручную будут затёрты.
// Контуры иконок Tabler (outline, MIT) для тех имён, что реально используются в интерфейсе.

export const iconPaths: Record<string, readonly string[]> = {
${entries.join('\n')}
};

export type IconName = keyof typeof iconPaths;
`;

writeFileSync(outFile, out);
console.log(`Иконок собрано: ${names.length} → ${outFile.replace(root, '.')}`);
