import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Платформенный слой — три ветки под одним интерфейсом (Tauri, Capacitor, браузер), и ошибка в
 * выборе ветки видна только на устройстве после релиза. Здесь подменяются сами плагины, поэтому
 * проверяется то, что приложение действительно попросит у платформы.
 */

const filesystem = {
  writeFile: vi.fn(async () => ({ uri: 'file:///cache/life-os-share/backup.json' })),
  rmdir: vi.fn(async () => undefined),
  deleteFile: vi.fn(async () => undefined),
};
const share = { share: vi.fn(async () => undefined) };
const tauriFs = { writeFile: vi.fn(async () => undefined), BaseDirectory: { Download: 'download' } };

vi.mock('@capacitor/filesystem', () => ({ Filesystem: filesystem, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor/share', () => ({ Share: share }));
vi.mock('@tauri-apps/plugin-fs', () => tauriFs);

function pretendCapacitor(): void {
  (window as unknown as Record<string, unknown>).Capacitor = { isNativePlatform: () => true };
}

function pretendTauri(): void {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).Capacitor;
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('сохранение файла', () => {
  it('на Android пишет в свой подкаталог кэша и отдаёт системе', async () => {
    pretendCapacitor();
    const { saveFile } = await import('./platform-files');

    const target = await saveFile('backup.json', new Blob(['{}']));

    expect(target).toBe('shared');
    // Свой подкаталог — чтобы очистка не трогала чужие файлы в общем кэше.
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'life-os-share/backup.json', recursive: true }),
    );
    expect(share.share).toHaveBeenCalledOnce();
  });

  it('на десктопе кладёт в «Загрузки» и ничем не делится', async () => {
    pretendTauri();
    const { saveFile } = await import('./platform-files');

    expect(await saveFile('backup.json', new Blob(['{}']))).toBe('downloads');
    expect(tauriFs.writeFile).toHaveBeenCalledOnce();
    expect(share.share).not.toHaveBeenCalled();
  });

  it('в браузере скачивает ссылкой', async () => {
    // jsdom не реализует object URL — подставляем заглушку, чтобы проверить именно выбор ветки.
    URL.createObjectURL = vi.fn(() => 'blob:life-os');
    URL.revokeObjectURL = vi.fn();
    const { saveFile } = await import('./platform-files');
    expect(await saveFile('backup.json', new Blob(['{}']))).toBe('browser');
    expect(filesystem.writeFile).not.toHaveBeenCalled();
    expect(tauriFs.writeFile).not.toHaveBeenCalled();
  });
});

describe('очистка кэша', () => {
  it('удаляет только свой подкаталог', async () => {
    pretendCapacitor();
    const { cleanupCache } = await import('./platform-files');

    await cleanupCache();

    expect(filesystem.rmdir).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'life-os-share', recursive: true }),
    );
  });

  it('вне Android не трогает ничего', async () => {
    const { cleanupCache } = await import('./platform-files');
    await cleanupCache();
    expect(filesystem.rmdir).not.toHaveBeenCalled();
  });

  it('отсутствие каталога не считается ошибкой', async () => {
    pretendCapacitor();
    filesystem.rmdir.mockRejectedValueOnce(new Error('Directory does not exist'));
    const { cleanupCache } = await import('./platform-files');
    await expect(cleanupCache()).resolves.toBeUndefined();
  });
});

describe('идентификаторы уведомлений', () => {
  it('ключ сворачивается в 32-битный int — id одинаков между запусками', async () => {
    const { notificationId } = await import('./platform-notify');
    const key = 'object-id:30:2026-08-21T00:00:00.000Z';

    const id = notificationId(key);
    expect(id).toBe(notificationId(key));
    expect(Number.isSafeInteger(id)).toBe(true);
    expect(Math.abs(id)).toBeLessThanOrEqual(2 ** 31);
    // Ноль Android принимает не везде — на него заменяется единица.
    expect(notificationId('')).toBe(1);
  });

  it('разные пороги одного объекта не сталкиваются', async () => {
    const { notificationId } = await import('./platform-notify');
    expect(notificationId('obj:30:2026-08-21')).not.toBe(notificationId('obj:7:2026-08-21'));
  });
});

describe('среда доставки напоминаний', () => {
  it('в браузере планировщика нет — уведомления только при запущенном приложении', async () => {
    const { supportsScheduling, notificationsSupported } = await import('./platform-notify');
    expect(supportsScheduling()).toBe(false);
    // jsdom не знает Notification, и это честно означает «уведомления недоступны».
    expect(notificationsSupported()).toBe('Notification' in window);
  });

  it('на Android приложение обещает доставку при закрытом окне', async () => {
    pretendCapacitor();
    const { supportsScheduling, notificationsSupported } = await import('./platform-notify');
    expect(supportsScheduling()).toBe(true);
    expect(notificationsSupported()).toBe(true);
  });
});
