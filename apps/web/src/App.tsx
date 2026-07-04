import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LedgerScreen } from './components/LedgerScreen';
import { ObjectDetailScreen } from './components/ObjectDetailScreen';
import { HouseholdScreen } from './components/HouseholdScreen';
import { DecisionsScreen } from './components/DecisionsScreen';
import { NavigatorScreen } from './components/NavigatorScreen';
import { useTheme } from './lib/theme';

type Route = 'today' | 'ledger' | 'household' | 'decisions' | 'navigator';

export function App() {
  const { theme, toggle } = useTheme();
  const [route, setRoute] = useState<Route>('ledger');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function navigate(key: string) {
    setSelectedId(null);
    setRoute(key as Route);
  }

  return (
    <div className="app">
      <Sidebar active={route} onNavigate={navigate} />
      {route === 'ledger' && selectedId ? (
        <ObjectDetailScreen id={selectedId} onBack={() => setSelectedId(null)} theme={theme} onToggleTheme={toggle} />
      ) : route === 'ledger' ? (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      ) : route === 'household' ? (
        <HouseholdScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'decisions' ? (
        <DecisionsScreen theme={theme} onToggleTheme={toggle} />
      ) : route === 'navigator' ? (
        <NavigatorScreen theme={theme} onToggleTheme={toggle} />
      ) : (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      )}
    </div>
  );
}
