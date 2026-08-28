/**
 * Сохранение файла на устройство и выбор файла — три разные среды под одним интерфейсом.
 * Нужно ровно для одного: резервных копий. Данные никуда не отправляются, файл остаётся у
 * пользователя (см. docs/SECURITY.md).
 */

export type SaveTarget = 'downloads' | 'shared' | 'browser';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  );
}

/** Свой подкаталог в кэше: чистить чужие файлы нельзя, а свои — нужно. */
const CACHE_DIR = 'life-os-share';

function cachePath(filename: string): string {
  return `${CACHE_DIR}/${filename}`;
}

/** Capacitor Filesystem принимает содержимое строкой base64. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let raw = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(raw);
}

/**
 * Сохранить файл. Возвращает, куда он попал, — интерфейс должен сказать это пользователю,
 * иначе «сохранено» без адреса бесполезно.
 *
 * Десктоп: папка «Загрузки» (разрешение fs:allow-download-write-recursive).
 * Android: файл во внутренний кэш + системное «Поделиться», чтобы человек сам выбрал,
 * куда его положить. Этот путь не требует ни одного разрешения на storage.
 */
export async function saveFile(filename: string, blob: Blob): Promise<SaveTarget> {
  if (isTauri()) {
    const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await writeFile(filename, new Uint8Array(await blob.arrayBuffer()), {
      baseDir: BaseDirectory.Download,
    });
    return 'downloads';
  }

  if (isCapacitor()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const path = cachePath(filename);
    const { uri } = await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Куда сохранить копию' });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'browser';
}

/**
 * Открыть файл вложения в системном просмотрщике.
 *
 * В WebView Capacitor blob-ссылка через window.open не открывается — файл нужно положить в кэш и
 * отдать системе. На десктопе и в браузере blob-ссылки работают штатно.
 */
export async function openFile(filename: string, mime: string, bytes: ArrayBuffer): Promise<void> {
  if (isCapacitor()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const path = cachePath(filename);
    const { uri } = await Filesystem.writeFile({
      path,
      data: await blobToBase64(new Blob([bytes], { type: mime })),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: filename, url: uri, dialogTitle: filename });
    return;
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, '_blank', 'noopener');
  // Освобождаем blob после того, как просмотрщик успел его загрузить (иначе утечка памяти).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Временные файлы прошлых запусков. Раньше каждый просмотренный скан и каждая резервная копия
 * оставались в кэше навсегда: открыл паспорт десять раз — десять копий скана лежат на устройстве
 * рядом с базой, и место они занимают молча.
 *
 * Файлы в общем каталоге кэша принадлежат не только нам, поэтому чистим строго свой подкаталог.
 *
 * Чистим на старте, а не сразу после «Поделиться»: система отдаёт файл принимающему приложению по
 * ссылке, и часть приложений читает её не сразу. Удалить файл в ту же секунду — значит иногда
 * отдавать пустоту.
 */
export async function cleanupCache(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    await Filesystem.rmdir({ path: CACHE_DIR, directory: Directory.Cache, recursive: true });
  } catch {
    // Каталога ещё нет — чистить нечего.
  }
}

export function saveTargetLabel(target: SaveTarget): string {
  if (target === 'downloads') return 'Копия сохранена в папку «Загрузки»';
  if (target === 'shared') return 'Копия готова — выберите, куда её сохранить';
  return 'Копия сохранена';
}
