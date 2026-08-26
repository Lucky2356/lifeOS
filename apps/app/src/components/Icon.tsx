import type { CSSProperties } from 'react';
import { iconPaths } from './icon-paths';

/**
 * Иконка интерфейса. Контуры лежат в сгенерированном `icon-paths.ts`
 * (`node scripts/build-icons.mjs`), а не в веб-шрифте: шрифт Tabler занимал 4,4 МБ в трёх форматах
 * и 5807 правил CSS ради тех же 34 иконок — около 79% веса сборки.
 *
 * Размер задаётся в `em`, поэтому иконка наследует `font-size` контейнера ровно так же, как это
 * делал шрифт: существующие `.rail-item`, `.icon-chip` и инлайновые размеры менять не нужно.
 */
export function Icon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = iconPaths[name];
  if (!paths) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
