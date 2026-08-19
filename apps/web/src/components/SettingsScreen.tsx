import { useEffect, useRef, useState } from 'react';
import {
  applyBackup,
  backupFilename,
  backupToBlob,
  readBackupFile,
  summarize,
  type BackupSummary,
} from '../lib/backup';
import { saveFile, saveTargetLabel } from '../lib/platform-files';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  supportsScheduling,
  type NotifyPermission,
} from '../lib/platform-notify';
import { clearAllData } from '../lib/store';
import { formatDateTime } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';

type Pending = { summary: BackupSummary; apply: () => Promise<void> };

export function SettingsScreen({
  theme,
  onToggleTheme,
  onBack,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}) {
  const [notifPerm, setNotifPerm] = useState<NotifyPermission>('default');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Pending | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void notificationPermission().then(setNotifPerm);
  }, []);

  async function exportBackup() {
    setBusy('export');
    setError(null);
    setMessage(null);
    try {
      const target = await saveFile(backupFilename(), await backupToBlob());
      setMessage(saveTargetLabel(target));
    } catch {
      setError('Не удалось сохранить копию');
    } finally {
      setBusy(null);
    }
  }

  async function pickBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      const backup = await readBackupFile(file);
      setPendingImport({
        summary: summarize(backup),
        apply: async () => {
          await applyBackup(backup);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл');
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const { apply } = pendingImport;
    setPendingImport(null);
    setBusy('import');
    try {
      await apply();
      // Экраны держат данные в состоянии — после подмены базы проще перечитать всё заново.
      window.location.reload();
    } catch {
      setError('Не удалось восстановить данные из копии');
      setBusy(null);
    }
  }

  async function wipe() {
    setConfirmWipe(false);
    await clearAllData();
    window.location.reload();
  }

  const summaryText = (s: BackupSummary) =>
    [
      `${s.objects} объектов реестра`,
      `${s.attachments} файлов`,
      `${s.decisions} решений`,
      `${s.tasks} задач`,
      `${s.members} людей`,
    ].join(', ');

  return (
    <main className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Назад
        </button>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      <div className="serif page-title">Настройки</div>
      <div className="page-sub" style={{ marginBottom: 20, maxWidth: 520 }}>
        Life OS работает только на этом устройстве. Данные не уходят в сеть, аккаунта нет — и это значит, что
        единственная их копия здесь. Сделайте резервную копию.
      </div>

      {notificationsSupported() && (
        <>
          <div className="section-label">Напоминания</div>
          <div className="list-card">
            <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <i className="ti ti-bell-ringing" aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <span style={{ flex: 1 }}>
                Уведомления о приближающихся сроках
                {supportsScheduling() ? (
                  <span className="page-sub"> · приходят, даже если приложение закрыто</span>
                ) : (
                  <span className="page-sub"> · пока приложение запущено</span>
                )}
              </span>
              {notifPerm === 'granted' ? (
                <span className="pill pill-ok">включены</span>
              ) : notifPerm === 'denied' ? (
                <span className="pill pill-none">запрещены в системе</span>
              ) : (
                <button
                  className="btn"
                  onClick={() => void requestNotificationPermission().then(setNotifPerm)}
                >
                  Разрешить
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div className="section-label" style={{ marginTop: 22 }}>
        Резервная копия
      </div>
      <div className="list-card">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <i className="ti ti-download" aria-hidden="true" style={{ color: 'var(--sage)' }} />
          <span style={{ flex: 1 }}>
            Сохранить копию всех данных
            <span className="page-sub"> · один файл, вместе с приложенными документами</span>
          </span>
          <button className="btn btn-primary" onClick={() => void exportBackup()} disabled={busy !== null}>
            {busy === 'export' ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <i className="ti ti-upload" aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
          <span style={{ flex: 1 }}>
            Восстановить из файла
            <span className="page-sub"> · текущие данные будут заменены</span>
          </span>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === 'import' ? 'Восстановление…' : 'Выбрать файл'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => void pickBackup(e)}
        />
      </div>

      {message && (
        <div style={{ color: 'var(--sage)', fontSize: 13, marginTop: 10 }} role="status">
          {message}
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginTop: 10 }} role="alert">
          {error}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 22 }}>
        Данные
      </div>
      <div className="list-card">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <i className="ti ti-trash" aria-hidden="true" style={{ color: 'var(--brick-ink)' }} />
          <span style={{ flex: 1 }}>
            Удалить все данные
            <span className="page-sub"> · без возможности восстановления, кроме резервной копии</span>
          </span>
          <button className="btn btn-danger" onClick={() => setConfirmWipe(true)}>
            Удалить
          </button>
        </div>
      </div>

      <div className="page-sub" style={{ marginTop: 24, fontSize: 12 }}>
        Life OS · версия {__APP_VERSION__} ·{' '}
        <a
          href="https://github.com/Lucky2356/lifeOS/blob/main/docs/PRIVACY.md"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--sage)' }}
        >
          Политика конфиденциальности
        </a>
      </div>

      {pendingImport && (
        <ConfirmDialog
          title="Восстановить данные из копии?"
          message={`В файле: ${summaryText(pendingImport.summary)}. Копия от ${formatDateTime(pendingImport.summary.exportedAt)}. Всё, что сейчас в приложении, будет заменено.`}
          confirmLabel="Восстановить"
          danger
          onConfirm={() => void confirmImport()}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {confirmWipe && (
        <ConfirmDialog
          title="Удалить все данные?"
          message="Объекты реестра, документы, решения, задачи и прогресс по плейбукам будут удалены с устройства. Восстановить их можно только из резервной копии."
          confirmLabel="Удалить всё"
          danger
          onConfirm={() => void wipe()}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </main>
  );
}
