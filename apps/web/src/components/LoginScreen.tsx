import { useState } from 'react';
import type { LoginResult } from '@life-os/domain';
import { authApi } from '../lib/auth-api';
import { authStore } from '../lib/auth-store';

export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleResult(res: LoginResult) {
    if (res.status === 'authenticated') {
      authStore.set(res.accessToken, res.refreshToken);
      onAuthenticated();
    } else {
      setChallenge(res.challengeToken);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (challenge) {
        handleResult(await authApi.mfaVerify(challenge, code));
      } else if (mode === 'register') {
        handleResult(await authApi.register(email, password));
      } else {
        handleResult(await authApi.login(email, password));
      }
    } catch {
      setError(
        challenge
          ? 'Неверный код'
          : mode === 'register'
            ? 'Не удалось зарегистрироваться (проверьте почту и пароль ≥ 8 символов)'
            : 'Неверная почта или пароль',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <i className="ti ti-inner-shadow-top-left" aria-hidden="true" />
        </div>
        <div className="serif" style={{ fontSize: 24, textAlign: 'center' }}>
          Life OS
        </div>
        <div className="page-sub" style={{ textAlign: 'center', marginBottom: 20 }}>
          {challenge ? 'Введите код из приложения-аутентификатора' : 'Ваша операционная система для жизни'}
        </div>

        {challenge ? (
          <div className="field">
            <label htmlFor="code">Код подтверждения</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoFocus
              placeholder="123456"
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="email">Почта</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                placeholder="name@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Не менее 8 символов"
              />
            </div>
          </>
        )}

        {error && <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy
            ? 'Подождите…'
            : challenge
              ? 'Подтвердить'
              : mode === 'register'
                ? 'Создать аккаунт'
                : 'Войти'}
        </button>

        {!challenge && (
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
