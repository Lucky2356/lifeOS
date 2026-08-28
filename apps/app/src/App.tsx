import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TodayScreen } from './components/TodayScreen';
import { LedgerScreen } from './components/LedgerScreen';
import { ObjectDetailScreen } from './components/ObjectDetailScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { DecisionsScreen } from './components/DecisionsScreen';
import { NavigatorScreen } from './components/NavigatorScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SearchScreen } from './components/SearchScreen';
import { useTheme } from './lib/theme';
import { ledgerStore, migrateLegacyLocalStorage, requestPersistentStorage } from './lib/store';
import { initNativeUpdate, openApkDownload, type AndroidUpdate } from './lib/native-update';
import { startReminderWatcher } from './lib/notifications';
import { initHardwareBack, pushBackStop } from './lib/history-nav';
import { cleanupCache } from './lib/platform-files';

type Route = 'today' | 'ledger' | 'household' | 'decisions' | 'navigator' | 'search' | 'settings';

export function App() {
  const { theme, preference, setPreference, toggle } = useTheme();
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
        // Корзина обязана пустеть сама, иначе обещание «через 30 дней» остаётся словами.
        void ledgerStore.purgeExpired().catch(() => {});
      });
    // Данные на устройстве — единственная копия, поэтому просим систему их не вытеснять.
    void requestPersistentStorage();
    // Desktop (Tauri) обновляется тихо; Android — баннер с предложением установить свежий APK.
    initNativeUpdate(setAndroidUpdate);
    // Аппаратная «Назад» на Android: без этого она закрывает приложение с любого экрана.
    void initHardwareBack();
    // Временные файлы предыдущего запуска (просмотр вложений, сохранение копии) больше не нужны.
    void cleanupCache();
  }, []);

  // «Назад» из карточки объекта возвращает к списку, а не выбрасывает из приложения.
  useEffect(() => {
    if (!selectedId) return;
    return pushBackStop(() => setSelectedId(null));
  }, [selectedId]);

  // «Назад» из любого раздела возвращает на «Сегодня» — верхний экран приложения.
  useEffect(() => {
    if (route === 'today') return;
    return pushBackStop(() => setRoute('today'));
  }, [route]);

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
          onOpenLedger={() => setRoute('ledger')}
          onOpenDecisions={() => setRoute('decisions')}
        />
      ) : route === 'ledger' ? (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      ) : route === 'household' ? (
        <HouseholdScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'decisions' ? (
        <DecisionsScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'navigator' ? (
        <NavigatorScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'search' ? (
        <SearchScreen
          theme={theme}
          onToggleTheme={toggle}
          onOpenObject={openObject}
          onOpenSection={(kind) =>
            setRoute(kind === 'task' ? 'household' : kind === 'decision' ? 'decisions' : 'navigator')
          }
        />
      ) : route === 'settings' ? (
        <SettingsScreen
          theme={theme}
          onToggleTheme={toggle}
          preference={preference}
          onSetPreference={setPreference}
          onBack={() => setRoute('today')}
        />
      ) : (
        <TodayScreen
          theme={theme}
          onToggleTheme={toggle}
          onOpenObject={openObject}
          onOpenSettings={() => setRoute('settings')}
          onOpenLedger={() => setRoute('ledger')}
          onOpenDecisions={() => setRoute('decisions')}
        />
      )}
    </div>
  );
}
