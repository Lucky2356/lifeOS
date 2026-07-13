import { useId, useState } from 'react';
import { useEscapeToClose } from '../lib/use-modal';

/**
 * Единые внутренние диалоги в стиле приложения (.overlay/.modal) — вместо нативных
 * window.prompt/confirm, которые выпадают из общего дизайна.
 */

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  useEscapeToClose(onCancel);
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="serif" style={{ fontSize: 20, margin: '0 0 10px' }}>
          {title}
        </h2>
        {message && (
          <p className="page-sub" style={{ margin: '0 0 18px' }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptDialog({
  title,
  label,
  placeholder,
  confirmLabel = 'Готово',
  onSubmit,
  onCancel,
}: {
  title: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const titleId = useId();
  useEscapeToClose(onCancel);
  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <h2 id={titleId} className="serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          {title}
        </h2>
        <div className="field">
          {label && <label htmlFor="prompt-input">{label}</label>}
          <input
            id="prompt-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={value.trim().length === 0}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
