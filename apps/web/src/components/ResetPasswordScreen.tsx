import { useState } from 'react';
import { authApi } from '../lib/auth-api';

/** Экран установки нового пароля по ссылке из письма (?reset=<token>). */
export function ResetPasswordScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('Пароль не менее 8 символов');
    if (password !== confirm) return setError('Пароли не совпадают');
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch {
      setError('Ссылка недействительна или устарела. Запросите сброс заново.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <i className="ti ti-lock-check" aria-hidden="true" />
        </div>
        <div className="serif" style={{ fontSize: 22, textAlign: 'center' }}>
          Новый пароль
        </div>
        {done ? (
          <>
            <div className="page-sub" style={{ textAlign: 'center', margin: '12px 0 18px' }}>
              Пароль изменён. Войдите с новым паролем.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onDone}
            >
              Войти
            </button>
          </>
        ) : (
          <>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="np">Новый пароль</label>
              <input
                id="np"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Не менее 8 символов"
              />
            </div>
            <div className="field">
              <label htmlFor="np2">Повторите пароль</label>
              <input id="np2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && (
              <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 10 }}>{error}</div>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {busy ? 'Сохраняем…' : 'Сохранить пароль'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              <button type="button" className="link-btn" onClick={onDone}>
                Отмена
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
