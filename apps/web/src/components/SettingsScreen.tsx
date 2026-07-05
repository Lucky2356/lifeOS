import { useEffect, useState } from 'react';
import { aiModules, type AiModule, type AiSettings } from '@life-os/domain';
import { aiApi } from '../lib/ai-api';
import { authApi } from '../lib/auth-api';
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

  useEffect(() => {
    void aiApi.getSettings().then(setSettings);
  }, []);

  async function patch(p: Parameters<typeof aiApi.updateSettings>[0]) {
    const updated = await aiApi.updateSettings(p);
    setSettings(updated);
  }

  async function startMfa() {
    setMfaError(null);
    setMfaSetup(await authApi.mfaSetup());
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

      {settings && (
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
              <span className="list-row-meta" style={{ textTransform: 'capitalize' }}>
                {settings.provider}
              </span>
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
            <div className="list-row">
              <i className="ti ti-logout" aria-hidden="true" style={{ color: 'var(--ink-2)' }} />
              <span style={{ flex: 1 }}>Выйти из аккаунта</span>
              <button className="btn btn-danger" onClick={doLogout}>
                Выйти
              </button>
            </div>
          </div>

          <div className="page-sub" style={{ marginTop: 24, fontSize: 12 }}>
            Life OS · версия {__APP_VERSION__} · обновляется автоматически
          </div>
        </>
      )}
    </main>
  );
}
