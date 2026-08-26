import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TodayScreen } from './components/TodayScreen';
import { LedgerScreen } from './components/LedgerScreen';
import { ObjectDetailScreen } from './components/ObjectDetailScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { DecisionsScreen } from './components/DecisionsScreen';
import { NavigatorScreen } from './components/NavigatorScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { useTheme } from './lib/theme';
import { migrateLegacyLocalStorage } from './lib/store';
import { initNativeUpdate, openApkDownload, type AndroidUpdate } from './lib/native-update';
import { startReminderWatcher } from './lib/notifications';

type Route = 'today' | 'ledger' | 'household' | 'decisions' | 'navigator' | 'settings';

export function App() {
  const { theme, toggle } = useTheme();
  const [route, setRoute] = useState<Route>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [androidUpdate, setAndroidUpdate] = useState<AndroidUpdate | null>(null);
  // Данные читаются только после переноса из прежнего localStorage — иначе экраны увидят пустоту.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void migrateLegacyLocalStorage()
      .catch(() => {
        /* перенос не критичен: приложение работает и с пустой базой */
      })
      .finally(() => {
        setReady(true);
        void startReminderWatcher();
      });
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

  if (!ready) {
    return (
      <div className="app">
        <main className="main">
          <div className="state">Загрузка…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
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
        <TodayScreen
          theme={theme}
          onToggleTheme={toggle}
          onOpenObject={openObject}
          onOpenSettings={() => setRoute('settings')}
        />
      ) : route === 'ledger' ? (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      ) : route === 'household' ? (
        <HouseholdScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'decisions' ? (
        <DecisionsScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'navigator' ? (
        <NavigatorScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'settings' ? (
        <SettingsScreen theme={theme} onToggleTheme={toggle} onBack={() => setRoute('today')} />
      ) : (
        <TodayScreen
          theme={theme}
          onToggleTheme={toggle}
          onOpenObject={openObject}
          onOpenSettings={() => setRoute('settings')}
        />
      )}
    </div>
  );
}
