import { useId, useState } from 'react';
import { objectTypeLabels, objectTypes, type CreateLifeObjectInput } from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { useEscapeToClose } from '../lib/use-modal';

export function AddObjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState(objectTypes[0]);
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  useEscapeToClose(onClose);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input: CreateLifeObjectInput = {
        type,
        title: title.trim(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      };
      await ledgerStore.create(input);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          Новый объект
        </h2>
        <div className="field">
          <label htmlFor="title">Название</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Загранпаспорт"
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="type">Тип</label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {objectTypes.map((t) => (
              <option key={t} value={t}>
                {objectTypeLabels[t].ru}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="validUntil">Действует до / дедлайн (необязательно)</label>
          <input
            id="validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
        {error && <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || title.trim().length === 0}>
            {busy ? 'Сохраняю…' : 'Добавить'}
          </button>
        </div>
      </form>
    </div>
  );
}
