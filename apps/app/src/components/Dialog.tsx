import { useId, useState } from 'react';
import { useEscapeToClose, useFocusTrap } from '../lib/use-modal';

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
  const trapRef = useFocusTrap<HTMLDivElement>();
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        ref={trapRef}
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
  message,
  label,
  placeholder,
  confirmLabel = 'Готово',
  secret = false,
  allowEmpty = false,
  emptyLabel,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  message?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Поле для пароля: скрытый ввод и подсказка менеджеру паролей. */
  secret?: boolean;
  /** Разрешить продолжить с пустым значением (например, «сохранить без пароля»). */
  allowEmpty?: boolean;
  emptyLabel?: string;
  error?: string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const titleId = useId();
  useEscapeToClose(onCancel);
  const trapRef = useFocusTrap<HTMLFormElement>();
  return (
    <div className="overlay" onClick={onCancel}>
      <form
        ref={trapRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() || allowEmpty) onSubmit(value.trim());
        }}
      >
        <h2 id={titleId} className="serif" style={{ fontSize: 20, margin: '0 0 16px' }}>
          {title}
        </h2>
        {message && (
          <p className="page-sub" style={{ margin: '-8px 0 16px' }}>
            {message}
          </p>
        )}
        <div className="field">
          {label && <label htmlFor="prompt-input">{label}</label>}
          <input
            id="prompt-input"
            type={secret ? 'password' : 'text'}
            autoComplete={secret ? 'current-password' : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
        {error && (
          <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 12 }} role="alert">
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
          {allowEmpty && emptyLabel && (
            <button type="button" className="btn" onClick={() => onSubmit('')}>
              {emptyLabel}
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!allowEmpty && value.trim().length === 0}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
