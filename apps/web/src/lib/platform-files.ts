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
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
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

export function saveTargetLabel(target: SaveTarget): string {
  if (target === 'downloads') return 'Копия сохранена в папку «Загрузки»';
  if (target === 'shared') return 'Копия готова — выберите, куда её сохранить';
  return 'Копия сохранена';
}
