import { useEffect, useState } from 'react';
import { aiModules, aiProviderOptions, type AiModule, type AiSettings } from '@life-os/domain';
import { aiApi } from '../lib/ai-api';
import { authApi } from '../lib/auth-api';
import { accountApi } from '../lib/account-api';
import { authStore } from '../lib/auth-store';
import { webauthnApi } from '../lib/webauthn-api';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../lib/notifications';
import type { Theme } from '../lib/theme';

const moduleLabels: Record<AiModule, { icon: string; label: string }> = {
  ledger: { icon: 'ti-folders', label: 'Реестр' },
  household: { icon: 'ti-home', label: 'Дом' },
  decision: { icon: 'ti-scale', label: 'Решения' },
  navigator: { icon: 'ti-compass', label: 'Навигатор' },
};

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      className={`switch ${on ? 'switch-on' : ''}`}
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label="Переключатель"
    >
      <span className="switch-knob" />
    </button>
  );
}

export function SettingsScreen({
  theme,
  onToggleTheme,
  onBack,
  onLogout,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<'ok' | 'err' | null>(null);
  const [notifyEmail, setNotifyEmail] = useState<boolean | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(notificationPermission());
  const isLocal = authStore.isLocal;

  useEffect(() => {
    if (isLocal) return; // в локальном режиме серверные настройки не запрашиваем
    void aiApi
      .getSettings()
      .then(setSettings)
      .catch(() => {});
    void accountApi
      .getNotifications()
      .then((n) => setNotifyEmail(n.notifyEmail))
      .catch(() => {});
  }, [isLocal]);

  async function toggleNotifyEmail() {
    const next = !(notifyEmail ?? true);
    setNotifyEmail(next);
    try {
      await accountApi.setNotifications(next);
    } catch {
      setNotifyEmail(!next); // откат при ошибке
    }
  }

  async function patch(p: Parameters<typeof aiApi.updateSettings>[0]) {
    const updated = await aiApi.updateSettings(p);
    setSettings(updated);
  }

  async function startMfa() {
    setMfaError(null);
    setMfaSetup(await authApi.mfaSetup());
  }

  async function addPasskey() {
    setPasskeyMsg(null);
    setPasskeyBusy(true);
    try {
      await webauthnApi.registerPasskey();
      setPasskeyMsg('ok');
      setMfaEnabled(true); // passkey — второй фактор, требование MFA включается
    } catch {
      setPasskeyMsg('err');
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function confirmMfa() {
    setMfaError(null);
    try {
      await authApi.mfaEnable(mfaCode);
      setMfaEnabled(true);
      setMfaSetup(null);
      setMfaCode('');
    } catch {
      setMfaError('Неверный код, попробуйте ещё раз');
    }
  }

  async function doLogout() {
    try {
      await authApi.logout();
    } catch {
      // сессия всё равно очищается локально
    }
    onLogout();
  }

  return (
    <main className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Назад
        </button>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      <div className="serif page-title">ИИ и приватность</div>
      <div className="page-sub" style={{ marginBottom: 20, maxWidth: 520 }}>
        ИИ — только помощник. Всё в Life OS работает и без него, вручную. Включайте там, где удобно, и
        выключайте в любой момент.
      </div>

      {notificationsSupported() && (
        <>
          <div className="section-label">Уведомления на устройстве</div>
          <div className="list-card">
            <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <i className="ti ti-bell-ringing" aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <span style={{ flex: 1 }}>
                Напоминания о сроках на этом устройстве
                <span className="page-sub"> · работают и без аккаунта</span>
              </span>
              {notifPerm === 'granted' ? (
                <span className="pill pill-ok">включены</span>
              ) : notifPerm === 'denied' ? (
                <span className="pill pill-none">запрещены в браузере</span>
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

      {isLocal && (
        <>
          <div className="section-label" style={{ marginTop: 22 }}>
            Аккаунт
          </div>
          <div className="list-card">
            <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <i className="ti ti-device-desktop" aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
              <span style={{ flex: 1 }}>
                Локальный режим
                <span className="page-sub"> · данные только на этом устройстве</span>
              </span>
              <button className="btn btn-primary" onClick={onLogout}>
                Создать аккаунт
              </button>
            </div>
            <div className="list-row">
              <span className="page-sub">
                Аккаунт добавляет вход с других устройств, синхронизацию, семейный доступ и двухфакторную
                защиту. Уже созданные локально данные загрузятся при первом входе. ИИ-подсказки тоже доступны
                с аккаунтом (ключ провайдера — на сервере).
              </span>
            </div>
          </div>
          <div className="page-sub" style={{ marginTop: 24, fontSize: 12 }}>
            Life OS · версия {__APP_VERSION__} · обновляется автоматически ·{' '}
            <a
              href="https://github.com/Lucky2356/lifeOS/blob/main/docs/PRIVACY.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--sage)' }}
            >
              Политика конфиденциальности
            </a>
          </div>
        </>
      )}

      {!isLocal && settings && (
        <>
          <div className="ai-hero">
            <span className="ai-hero-icon">
              <i className="ti ti-sparkles" aria-hidden="true" />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>ИИ-ассистент</div>
              <div className="page-sub">Подсказки, помощь с формами, следующий шаг</div>
            </div>
            <Switch
              on={settings.globalEnabled}
              onClick={() => patch({ globalEnabled: !settings.globalEnabled })}
            />
          </div>

          <div className="section-label">По модулям</div>
          <div className="list-card" style={{ marginBottom: 22, opacity: settings.globalEnabled ? 1 : 0.55 }}>
            {aiModules.map((m) => (
              <div className="list-row" key={m}>
                <i
                  className={`ti ${moduleLabels[m].icon}`}
                  aria-hidden="true"
                  style={{ color: 'var(--sage)' }}
                />
                <span style={{ flex: 1 }}>{moduleLabels[m].label}</span>
                <Switch
                  on={settings.perModule[m] ?? false}
                  onClick={() => patch({ perModule: { [m]: !(settings.perModule[m] ?? false) } })}
                />
              </div>
            ))}
          </div>

          <div className="section-label">Приватность данных</div>
          <div className="list-card">
            <div className="list-row">
              <i className="ti ti-lock" aria-hidden="true" style={{ color: 'var(--brick-ink)' }} />
              <span style={{ flex: 1 }}>
                Отправлять чувствительные данные ИИ
                <span className="page-sub"> · медкарты и документы не отправляются без разрешения</span>
              </span>
              <Switch
                on={settings.shareSensitive}
                onClick={() => patch({ shareSensitive: !settings.shareSensitive })}
              />
            </div>
            <div className="list-row">
              <i className="ti ti-cpu" aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
              <span style={{ flex: 1 }}>Провайдер ИИ</span>
              <select
                value={settings.provider === 'noop' ? 'claude' : settings.provider}
                onChange={(e) => patch({ provider: e.target.value as AiSettings['provider'] })}
                aria-label="Провайдер ИИ"
              >
                {aiProviderOptions.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="list-row">
              <i className="ti ti-key" aria-hidden="true" style={{ color: 'var(--ink-3)' }} />
              <span className="page-sub" style={{ flex: 1 }}>
                Ключ провайдера задаётся на сервере (
                {aiProviderOptions.find((p) => p.name === settings.provider)?.hint ?? 'ключ в окружении'}).
                Без ключа ИИ просто не подключается — приложение работает как обычно.
              </span>
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 22 }}>
            Напоминания
          </div>
          <div className="list-card">
            <div className="list-row">
              <i className="ti ti-bell" aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <span style={{ flex: 1 }}>
                Письма о приближающихся сроках
                <span className="page-sub"> · дайджест на почту, когда документы скоро истекают</span>
              </span>
              <Switch on={notifyEmail ?? true} onClick={toggleNotifyEmail} />
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 22 }}>
            Безопасность
          </div>
          <div className="list-card">
            <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <i className="ti ti-shield-lock" aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <span style={{ flex: 1 }}>
                Двухфакторная защита (TOTP)
                <span className="page-sub"> · Google Authenticator, 1Password и др.</span>
              </span>
              {mfaEnabled ? (
                <span className="pill pill-ok">включена</span>
              ) : (
                <button className="btn" onClick={startMfa}>
                  Включить
                </button>
              )}
            </div>
            {mfaSetup && (
              <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div className="page-sub">Добавьте секрет в приложение-аутентификатор и введите код:</div>
                <code style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--ink-2)' }}>
                  {mfaSetup.secret}
                </code>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="inline-input"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="123456"
                  />
                  <button className="btn btn-primary" onClick={confirmMfa} disabled={mfaCode.length < 6}>
                    Подтвердить
                  </button>
                </div>
                {mfaError && <div style={{ color: 'var(--brick-ink)', fontSize: 13 }}>{mfaError}</div>}
              </div>
            )}
            {webauthnApi.supported() && (
              <div className="list-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                <i className="ti ti-fingerprint" aria-hidden="true" style={{ color: 'var(--sage)' }} />
                <span style={{ flex: 1 }}>
                  Ключ доступа (passkey)
                  <span className="page-sub"> · Touch ID, Windows Hello, аппаратный ключ</span>
                  {passkeyMsg === 'ok' && (
                    <span className="page-sub" style={{ color: 'var(--sage)' }}>
                      {' '}
                      · ключ добавлен
                    </span>
                  )}
                  {passkeyMsg === 'err' && (
                    <span className="page-sub" style={{ color: 'var(--brick-ink)' }}>
                      {' '}
                      · не удалось добавить
                    </span>
                  )}
                </span>
                <button className="btn" onClick={addPasskey} disabled={passkeyBusy}>
                  {passkeyBusy ? 'Добавление…' : 'Добавить ключ'}
                </button>
              </div>
            )}
            <div className="list-row">
              <i className="ti ti-logout" aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
              <span style={{ flex: 1 }}>Выйти из аккаунта</span>
              <button className="btn btn-danger" onClick={doLogout}>
                Выйти
              </button>
            </div>
          </div>

          <div className="page-sub" style={{ marginTop: 24, fontSize: 12 }}>
            Life OS · версия {__APP_VERSION__} · обновляется автоматически ·{' '}
            <a
              href="https://github.com/Lucky2356/lifeOS/blob/main/docs/PRIVACY.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--sage)' }}
            >
              Политика конфиденциальности
            </a>
          </div>
        </>
      )}
    </main>
  );
}
