import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TodayScreen } from './components/TodayScreen';
import { LedgerScreen } from './components/LedgerScreen';
import { ObjectDetailScreen } from './components/ObjectDetailScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { DecisionsScreen } from './components/DecisionsScreen';
import { NavigatorScreen } from './components/NavigatorScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { LoginScreen } from './components/LoginScreen';
import { SyncIndicator } from './components/SyncIndicator';
import { useTheme } from './lib/theme';
import { authStore } from './lib/auth-store';
import { setUnauthHandler } from './lib/http';
import { initNativeUpdate, openApkDownload, type AndroidUpdate } from './lib/native-update';

type Route = 'today' | 'ledger' | 'household' | 'decisions' | 'navigator' | 'settings';

export function App() {
  const { theme, toggle } = useTheme();
  const [authed, setAuthed] = useState(authStore.isAuthenticated);
  const [route, setRoute] = useState<Route>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [androidUpdate, setAndroidUpdate] = useState<AndroidUpdate | null>(null);

  useEffect(() => {
    setUnauthHandler(() => setAuthed(false));
    // Desktop (Tauri) обновляется тихо; Android — баннер с предложением установить свежий APK.
    initNativeUpdate(setAndroidUpdate);
  }, []);

  function navigate(key: string) {
    setSelectedId(null);
    setRoute(key as Route);
  }

  function openObject(id: string) {
    setRoute('ledger');
    setSelectedId(id);
  }

  function logout() {
    authStore.clear();
    setAuthed(false);
    setRoute('today');
  }

  // Выход из локального режима к экрану входа/регистрации (данные на устройстве сохраняются в кэше).
  function exitToLogin() {
    authStore.clear();
    setAuthed(false);
  }

  if (!authed) {
    return <LoginScreen onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <div className="app">
      <SyncIndicator />
      {androidUpdate && (
        <div className="update-banner" role="status">
          <span>Доступна новая версия {androidUpdate.version}. Обновите приложение — данные сохранятся.</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => openApkDownload(androidUpdate.apkUrl)}>
              Обновить
            </button>
            <button className="btn btn-ghost" onClick={() => setAndroidUpdate(null)} aria-label="Позже">
              Позже
            </button>
          </span>
        </div>
      )}
      <Sidebar active={route} onNavigate={navigate} />
      {route === 'ledger' && selectedId ? (
        <ObjectDetailScreen
          id={selectedId}
          onBack={() => setSelectedId(null)}
          theme={theme}
          onToggleTheme={toggle}
        />
      ) : route === 'today' ? (
        <TodayScreen theme={theme} onToggleTheme={toggle} onOpenObject={openObject} />
      ) : route === 'ledger' ? (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      ) : route === 'household' ? (
        <HouseholdScreen theme={theme} onToggleTheme={toggle} onCreateAccount={exitToLogin} />
      ) : route === 'decisions' ? (
        <DecisionsScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'navigator' ? (
        <NavigatorScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'settings' ? (
        <SettingsScreen
          theme={theme}
          onToggleTheme={toggle}
          onBack={() => setRoute('today')}
          onLogout={logout}
        />
      ) : (
        <TodayScreen theme={theme} onToggleTheme={toggle} onOpenObject={openObject} />
      )}
    </div>
  );
}
