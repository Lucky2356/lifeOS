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
  const [forgot, setForgot] = useState<'no' | 'form' | 'sent'>('no');
  // В нативных оболочках (Tauri/Capacitor) нет общего origin с бэкендом — даём указать адрес сервера.
  const isNative =
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window ||
      Boolean(
        (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(),
      ));
  const [server, setServer] = useState(
    () => localStorage.getItem('los-api-base') ?? (import.meta.env.VITE_API_BASE as string) ?? '',
  );
  function saveServer(value: string) {
    setServer(value);
    if (value.trim()) localStorage.setItem('los-api-base', value.trim());
    else localStorage.removeItem('los-api-base');
  }

  function continueLocal() {
    // Локальный режим: постоянный локальный id, без сервера. Данные останутся на устройстве.
    const existing = authStore.userId;
    authStore.setLocal(existing && authStore.isLocal ? existing : crypto.randomUUID());
    onAuthenticated();
  }

  function handleResult(res: LoginResult) {
    if (res.status === 'authenticated') {
      authStore.set(res.accessToken, res.refreshToken, res.user.id);
      onAuthenticated();
    } else {
      setChallenge(res.challengeToken);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setForgot('sent');
    } catch {
      setError('Не удалось отправить письмо. Проверьте адрес сервера и попробуйте снова.');
    } finally {
      setBusy(false);
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

  if (forgot !== 'no') {
    return (
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={submitForgot}>
          <div className="auth-logo">
            <i className="ti ti-key" aria-hidden="true" />
          </div>
          <div className="serif" style={{ fontSize: 22, textAlign: 'center' }}>
            Сброс пароля
          </div>
          {forgot === 'sent' ? (
            <>
              <div className="page-sub" style={{ textAlign: 'center', margin: '12px 0 18px' }}>
                Если {email} зарегистрирован, мы отправили письмо со ссылкой для нового пароля. Проверьте
                почту, в том числе папку «Спам».
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setForgot('no');
                  setError(null);
                }}
              >
                Вернуться ко входу
              </button>
            </>
          ) : (
            <>
              <div className="page-sub" style={{ textAlign: 'center', marginBottom: 16 }}>
                Введите почту — пришлём ссылку для установки нового пароля.
              </div>
              <div className="field">
                <label htmlFor="forgot-email">Почта</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  placeholder="name@example.com"
                />
              </div>
              {isNative && (
                <div className="field">
                  <label htmlFor="forgot-server">Адрес сервера</label>
                  <input
                    id="forgot-server"
                    value={server}
                    onChange={(e) => saveServer(e.target.value)}
                    placeholder="http://192.168.1.10:3011/api/v1"
                  />
                </div>
              )}
              {error && (
                <div style={{ color: 'var(--brick-ink)', fontSize: 13, marginBottom: 10 }}>{error}</div>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || !email.trim()}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {busy ? 'Отправляем…' : 'Отправить ссылку'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setForgot('no');
                    setError(null);
                  }}
                >
                  Назад ко входу
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    );
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

        {isNative && !challenge && (
          <div className="field">
            <label htmlFor="server">Адрес сервера</label>
            <input
              id="server"
              value={server}
              onChange={(e) => saveServer(e.target.value)}
              placeholder="http://192.168.1.10:3011/api/v1"
            />
          </div>
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              marginTop: 14,
              fontSize: 13,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="link-btn"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setForgot('form');
                  setError(null);
                }}
              >
                Забыли пароль?
              </button>
            )}
          </div>
        )}

        {!challenge && (
          <>
            <div className="auth-divider">
              <span>или</span>
            </div>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={continueLocal}
            >
              <i className="ti ti-device-desktop" aria-hidden="true" /> Продолжить без аккаунта
            </button>
            <div className="page-sub" style={{ textAlign: 'center', marginTop: 8, fontSize: 12 }}>
              Данные останутся на этом устройстве. Аккаунт можно создать позже — для входа с телефона и
              синхронизации.
            </div>
          </>
        )}
      </form>
    </div>
  );
}
