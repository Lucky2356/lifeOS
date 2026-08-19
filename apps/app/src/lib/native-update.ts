/**
 * Автообновление нативных оболочек.
 * - Desktop (Tauri): тихое обновление — скачать подписанный апдейт из GitHub Releases и перезапуститься.
 * - Android (Capacitor, sideload): проверить манифест релиза и предложить установить свежий APK
 *   (Android ставит APK после подтверждения; тихая замена всего пакета без стора невозможна).
 * - Web: здесь ничего — обновляет service worker (мгновенно).
 */

const MANIFEST = 'https://github.com/Lucky2356/lifeOS/releases/latest/download/mobile-update.json';

export type AndroidUpdate = { version: string; apkUrl: string; notes?: string };

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
function isCapacitor(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())
  );
}

/** Desktop: проверить обновление, установить и перезапуститься. Тихо, на старте. */
async function runTauriUpdate(): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    }
  } catch {
    /* обновление не критично — приложение полноценно работает и без него */
  }
}

/** Android: сравнить версию из манифеста релиза с текущей сборкой. */
async function checkAndroidUpdate(): Promise<AndroidUpdate | null> {
  try {
    const res = await fetch(MANIFEST, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AndroidUpdate>;
    if (data.version && data.apkUrl && data.version !== __APP_VERSION__) {
      return { version: data.version, apkUrl: data.apkUrl, notes: data.notes };
    }
  } catch {
    /* офлайн — проверим при следующем запуске */
  }
  return null;
}

/**
 * Запускается один раз на старте. На десктопе обновляется само; на Android вызывает колбэк с
 * данными обновления (UI покажет ненавязчивый баннер).
 */
export function initNativeUpdate(onAndroidUpdate: (u: AndroidUpdate) => void): void {
  if (isTauri()) {
    void runTauriUpdate();
  } else if (isCapacitor()) {
    void checkAndroidUpdate().then((u) => {
      if (u) onAndroidUpdate(u);
    });
  }
}

/** Открыть загрузку нового APK (Android предложит установку после скачивания). */
export function openApkDownload(url: string): void {
  window.open(url, '_blank', 'noopener');
}
