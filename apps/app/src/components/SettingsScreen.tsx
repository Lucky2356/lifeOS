import { useEffect, useRef, useState } from 'react';
import {
  applyBackup,
  backupFilename,
  BackupEncrypted,
  backupToBlob,
  dropRollback,
  lastBackupAt,
  readBackupFile,
  rememberBackup,
  stashRollback,
  summarize,
  takeRollback,
  undoImport,
  type BackupSummary,
  type StashedRollback,
} from '../lib/backup';
import { WrongPassword } from '../lib/backup-crypto';
import { saveFile, saveTargetLabel } from '../lib/platform-files';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  supportsScheduling,
} from '../lib/notifications';
import type { NotifyPermission } from '../lib/platform-notify';
import { clearAllData, storageUsage, type StorageUsage } from '../lib/store';
import { counted, formatDateTime } from '../lib/format';
import { themeLabels, type Theme, type ThemePreference } from '../lib/theme';
import { ConfirmDialog, PromptDialog } from './Dialog';
import { Icon } from './Icon';

type Pending = { summary: BackupSummary; apply: () => Promise<void> };

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} МБ`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
}

export function SettingsScreen({
  theme,
  onToggleTheme,
  preference,
  onSetPreference,
  onBack,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  preference: ThemePreference;
  onSetPreference: (next: ThemePreference) => void;
  onBack: () => void;
}) {
  const [notifPerm, setNotifPerm] = useState<NotifyPermission>('default');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Pending | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [askExportPassword, setAskExportPassword] = useState(false);
  /** Снимок состояния до импорта: пока он есть, восстановление можно отменить. */
  const [rollback, setRollback] = useState<StashedRollback | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  // Файл ждёт пароля: копия зашифрована, без него её не прочитать.
  const [lockedFile, setLockedFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void notificationPermission().then(setNotifPerm);
    void lastBackupAt().then(setLastBackup);
    void storageUsage().then(setStorage);
    void takeRollback().then(setRollback);
  }, []);

  async function exportBackup(password: string) {
    setAskExportPassword(false);
    setBusy('export');
    setError(null);
    setMessage(null);
    try {
      const target = await saveFile(backupFilename(), await backupToBlob(password || undefined));
      // Отмечаем только после реально сохранённого файла — иначе напоминание врало бы.
      await rememberBackup();
      setLastBackup(new Date().toISOString());
      setMessage(saveTargetLabel(target));
    } catch {
      setError('Не удалось сохранить копию');
    } finally {
      setBusy(null);
    }
  }

  async function openBackup(file: File, password?: string) {
    try {
      const backup = await readBackupFile(file, password);
      setLockedFile(null);
      setPasswordError(null);
      setPendingImport({
        summary: summarize(backup),
        apply: async () => {
          await applyBackup(backup);
        },
      });
    } catch (err) {
      if (err instanceof BackupEncrypted) {
        setLockedFile(file);
        setPasswordError(null);
        return;
      }
      if (err instanceof WrongPassword) {
        setLockedFile(file);
        setPasswordError(err.message);
        return;
      }
      setLockedFile(null);
      setError(err instanceof Error ? err.message : 'Не удалось прочитать файл');
    }
  }

  async function pickBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    await openBackup(file);
  }

  async function confirmImport() {
    if (!pendingImport) return;
    const { apply } = pendingImport;
    setPendingImport(null);
    setBusy('import');
    try {
      // Прежние данные откладываем целиком: ошиблись файлом — вернуть их будет неоткуда.
      // Снимок переживает и импорт, и перезагрузку: настройки при импорте не чистятся.
      const stashed = await stashRollback();
      if (!stashed) {
        setError(
          'Данных слишком много, чтобы отложить их на случай отмены. Сохраните резервную копию текущих данных и повторите.',
        );
        setBusy(null);
        return;
      }
      await apply();
      // Экраны держат данные в состоянии — после подмены базы проще перечитать всё заново.
      window.location.reload();
    } catch {
      setError('Не удалось восстановить данные из копии');
      setBusy(null);
    }
  }

  async function undo() {
    setConfirmUndo(false);
    setBusy('import');
    try {
      await undoImport();
      window.location.reload();
    } catch {
      setError('Не удалось вернуть прежние данные');
      setBusy(null);
    }
  }

  async function keepImported() {
    await dropRollback();
    setRollback(null);
  }

  async function wipe() {
    setConfirmWipe(false);
    await clearAllData();
    window.location.reload();
  }

  const summaryText = (s: BackupSummary) =>
    [
      counted(s.objects, 'объект', 'объекта', 'объектов') + ' реестра',
      counted(s.attachments, 'файл', 'файла', 'файлов'),
      counted(s.decisions, 'решение', 'решения', 'решений'),
      counted(s.tasks, 'задача', 'задачи', 'задач'),
      counted(s.members, 'человек', 'человека', 'человек'),
    ].join(', ');

  return (
    <main className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrow-left" /> Назад
        </button>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      <div className="serif page-title">Настройки</div>
      <div className="page-sub" style={{ marginBottom: 20, maxWidth: 520 }}>
        Life OS работает только на этом устройстве. Данные не уходят в сеть, аккаунта нет — и это значит, что
        единственная их копия здесь. Сделайте резервную копию.
      </div>

      <div className="section-label">Внешний вид</div>
      <div className="list-card">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} style={{ color: 'var(--sage)' }} />
          <span style={{ flex: 1 }}>
            Тема
            <span className="page-sub">
              {preference === 'system' ? ' · следует за настройками устройства' : ' · выбрана вручную'}
            </span>
          </span>
          <select
            value={preference}
            onChange={(e) => onSetPreference(e.target.value as ThemePreference)}
            aria-label="Тема оформления"
          >
            {(Object.keys(themeLabels) as ThemePreference[]).map((p) => (
              <option key={p} value={p}>
                {themeLabels[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notificationsSupported() && (
        <>
          <div className="section-label">Напоминания</div>
          <div className="list-card">
            <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <Icon name="bell-ringing" style={{ color: 'var(--sage)' }} />
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

      {rollback && (
        <div className="hint" style={{ marginBottom: 18 }} role="status">
          <Icon name="upload" />
          <span style={{ flex: 1 }}>
            Данные восстановлены из копии. Прежние сохранены и могут вернуться — они были на устройстве{' '}
            {formatDateTime(rollback.at)}.
          </span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setConfirmUndo(true)} disabled={busy !== null}>
              Отменить
            </button>
            <button className="btn btn-ghost" onClick={() => void keepImported()}>
              Оставить
            </button>
          </span>
        </div>
      )}

      <div className="section-label" style={{ marginTop: 22 }}>
        Резервная копия
      </div>
      <div className="list-card">
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Icon name="download" style={{ color: 'var(--sage)' }} />
          <span style={{ flex: 1 }}>
            Сохранить копию всех данных
            <span className="page-sub">
              {' · '}
              {lastBackup
                ? `последняя копия ${formatDateTime(lastBackup)}`
                : 'копия ещё ни разу не сохранялась'}
              {' · можно защитить паролем'}
            </span>
          </span>
          <button
            className="btn btn-primary"
            onClick={() => setAskExportPassword(true)}
            disabled={busy !== null}
          >
            {busy === 'export' ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Icon name="upload" style={{ color: 'var(--ink-2)' }} />
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
        <div style={{ color: 'var(--sage)', fontSize: 13, marginTop: 10 }} role="status" aria-live="polite">
          {message}
        </div>
      )}
      {error && (
        <div
          style={{ color: 'var(--brick-ink)', fontSize: 13, marginTop: 10 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 22 }}>
        Данные
      </div>
      <div className="list-card">
        {storage && (
          <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <Icon name="folders" style={{ color: 'var(--ink-2)' }} />
            <span style={{ flex: 1 }}>
              Занято на устройстве
              <span className="page-sub">
                {' · '}
                {storage.persistent
                  ? 'система не вытеснит эти данные'
                  : 'система может очистить их при нехватке места'}
              </span>
            </span>
            <span className="list-row-meta">
              {formatBytes(storage.usage)}
              {storage.quota > 0 && ` из ${formatBytes(storage.quota)}`}
            </span>
          </div>
        )}
        <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <Icon name="trash" style={{ color: 'var(--brick-ink)' }} />
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

      {askExportPassword && (
        <PromptDialog
          title="Защитить копию паролем?"
          message="Копия содержит номера документов, медицинские записи и суммы. Без пароля она читается как обычный текст везде, куда вы её положите. Пароль восстановить нельзя — забудете, копия станет бесполезной."
          label="Пароль"
          placeholder="Придумайте пароль"
          confirmLabel="Зашифровать и сохранить"
          secret
          allowEmpty
          emptyLabel="Сохранить без пароля"
          onSubmit={(value) => void exportBackup(value)}
          onCancel={() => setAskExportPassword(false)}
        />
      )}

      {lockedFile && (
        <PromptDialog
          title="Копия защищена паролем"
          message="Введите пароль, которым она была зашифрована."
          label="Пароль"
          confirmLabel="Открыть"
          secret
          error={passwordError}
          onSubmit={(value) => void openBackup(lockedFile, value)}
          onCancel={() => {
            setLockedFile(null);
            setPasswordError(null);
          }}
        />
      )}

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

      {confirmUndo && (
        <ConfirmDialog
          title="Вернуть прежние данные?"
          message={`Всё, что появилось после восстановления, будет заменено данными на момент ${formatDateTime(rollback?.at ?? '')}.`}
          confirmLabel="Вернуть"
          danger
          onConfirm={() => void undo()}
          onCancel={() => setConfirmUndo(false)}
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
