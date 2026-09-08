import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '@life-os/domain';
import { AttachmentFailure, attachmentsStore } from '../lib/store';
import { openFile } from '../lib/platform-files';
import { ConfirmDialog } from './Dialog';
import { Icon } from './Icon';
import { useT, type TFunction } from '../lib/i18n';

function fmtSize(n: number, t: TFunction): string {
  if (n < 1024) return t('attachments.bytes', { n });
  if (n < 1048576) return t('attachments.kilobytes', { n: Math.round(n / 1024) });
  return t('attachments.megabytes', { n: (n / 1048576).toFixed(1) });
}
function iconFor(mime: string): string {
  if (mime.startsWith('image/')) return 'photo';
  return mime === 'application/pdf' ? 'file-type-pdf' : 'file';
}
function messageFor(err: unknown, t: TFunction): string {
  if (err instanceof AttachmentFailure) {
    if (err.code === 'too-large') return t('attachments.tooLarge');
    if (err.code === 'unsupported') return t('attachments.unsupported');
    if (err.code === 'no-space') return t('attachments.noSpace');
  }
  return t('attachments.addFailed');
}

/** Вложения к объекту реестра. Файлы хранятся на этом устройстве, рядом с самим объектом. */
export function Attachments({ objectId }: { objectId: string }) {
  const t = useT();
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
      setError(messageFor(err, t));
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
      setError(t('attachments.openFailed'));
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
        {t('attachments.section')}
        <button className="reveal-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="upload" /> {busy ? t('attachments.adding') : t('attachments.add')}
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
            {t('attachments.empty')}
          </div>
        )}
        {items.map((a) => (
          <div className="list-row" key={a.id}>
            <Icon name={iconFor(a.mime)} style={{ color: 'var(--sage)' }} />
            <button className="link-btn" style={{ flex: 1, textAlign: 'left' }} onClick={() => open(a.id)}>
              {a.filename}
            </button>
            <span className="list-row-meta">{fmtSize(a.size, t)}</span>
            <button
              className="reveal-btn"
              onClick={() => setConfirmId(a.id)}
              aria-label={t('attachments.delete')}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>
      {error && (
        <div
          style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 18 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
      {confirmId && (
        <ConfirmDialog
          title={t('attachments.deleteTitle')}
          confirmLabel={t('attachments.deleteConfirm')}
          danger
          onConfirm={() => remove(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </>
  );
}
