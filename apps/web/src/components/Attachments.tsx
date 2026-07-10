import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '@life-os/domain';
import { attachmentsApi } from '../lib/attachments-api';
import { authStore } from '../lib/auth-store';
import { ConfirmDialog } from './Dialog';

function fmtSize(n: number): string {
  return n < 1024 ? `${n} Б` : n < 1048576 ? `${Math.round(n / 1024)} КБ` : `${(n / 1048576).toFixed(1)} МБ`;
}
function iconFor(mime: string): string {
  return mime.startsWith('image/') ? 'ti-photo' : mime === 'application/pdf' ? 'ti-file-type-pdf' : 'ti-file';
}

/** Вложения файлов к объекту реестра (документы). Требует аккаунт — файлы хранятся на сервере. */
export function Attachments({ objectId }: { objectId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isLocal = authStore.isLocal;

  const load = useCallback(() => {
    if (isLocal) return;
    attachmentsApi
      .list(objectId)
      .then(setItems)
      .catch(() => {});
  }, [objectId, isLocal]);
  useEffect(() => load(), [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await attachmentsApi.upload(objectId, file);
      load();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === '400'
          ? 'Можно загружать PDF или изображения'
          : code === '413'
            ? 'Файл больше 10 МБ'
            : 'Не удалось загрузить файл',
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function open(id: string) {
    try {
      window.open(await attachmentsApi.blobUrl(id), '_blank', 'noopener');
    } catch {
      setError('Не удалось открыть файл');
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    await attachmentsApi.remove(id);
    load();
  }

  if (isLocal) {
    return (
      <>
        <div className="section-label">Документы</div>
        <div className="list-card" style={{ marginBottom: 22 }}>
          <div className="list-row">
            <span className="page-sub">
              Вложения файлов (сканы, PDF) доступны с аккаунтом — хранятся на сервере в зашифрованном виде.
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-label">
        Документы
        <button className="reveal-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <i className="ti ti-upload" aria-hidden="true" /> {busy ? 'загрузка…' : 'добавить файл'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        style={{ display: 'none' }}
        onChange={onPick}
      />
      <div className="list-card" style={{ marginBottom: error ? 8 : 22 }}>
        {items.length === 0 && (
          <div className="list-row" style={{ color: 'var(--ink-3)' }}>
            Приложите скан или PDF документа
          </div>
        )}
        {items.map((a) => (
          <div className="list-row" key={a.id}>
            <i className={`ti ${iconFor(a.mime)}`} aria-hidden="true" style={{ color: 'var(--sage)' }} />
            <button className="link-btn" style={{ flex: 1, textAlign: 'left' }} onClick={() => open(a.id)}>
              {a.filename}
            </button>
            <span className="list-row-meta">{fmtSize(a.size)}</span>
            <button className="reveal-btn" onClick={() => setConfirmId(a.id)} aria-label="Удалить файл">
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {error && <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 18 }}>{error}</div>}
      {confirmId && (
        <ConfirmDialog
          title="Удалить файл?"
          confirmLabel="Удалить"
          danger
          onConfirm={() => remove(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </>
  );
}
