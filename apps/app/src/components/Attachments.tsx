import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '@life-os/domain';
import { AttachmentFailure, attachmentsStore } from '../lib/store';
import { openFile } from '../lib/platform-files';
import { ConfirmDialog } from './Dialog';

function fmtSize(n: number): string {
  return n < 1024 ? `${n} Б` : n < 1048576 ? `${Math.round(n / 1024)} КБ` : `${(n / 1048576).toFixed(1)} МБ`;
}
function iconFor(mime: string): string {
  return mime.startsWith('image/') ? 'ti-photo' : mime === 'application/pdf' ? 'ti-file-type-pdf' : 'ti-file';
}
function messageFor(err: unknown): string {
  if (err instanceof AttachmentFailure) {
    if (err.code === 'too-large') return 'Файл больше 25 МБ';
    if (err.code === 'unsupported') return 'Можно приложить PDF или изображение';
  }
  return 'Не удалось добавить файл';
}

/** Вложения к объекту реестра. Файлы хранятся на этом устройстве, рядом с самим объектом. */
export function Attachments({ objectId }: { objectId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    void attachmentsStore
      .list(objectId)
      .then(setItems)
      .catch(() => {});
  }, [objectId]);
  useEffect(() => load(), [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await attachmentsStore.add(objectId, file);
      load();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function open(id: string) {
    try {
      const { meta, bytes } = await attachmentsStore.read(id);
      await openFile(meta.filename, meta.mime, bytes);
    } catch {
      setError('Не удалось открыть файл');
    }
  }

  async function remove(id: string) {
    setConfirmId(null);
    await attachmentsStore.remove(id);
    load();
  }

  return (
    <>
      <div className="section-label">
        Документы
        <button className="reveal-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <i className="ti ti-upload" aria-hidden="true" /> {busy ? 'добавление…' : 'добавить файл'}
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
