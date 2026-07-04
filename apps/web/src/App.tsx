import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LedgerScreen } from './components/LedgerScreen';
import { ObjectDetailScreen } from './components/ObjectDetailScreen';
import { useTheme } from './lib/theme';

export function App() {
  const { theme, toggle } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="app">
      <Sidebar active="ledger" />
      {selectedId ? (
        <ObjectDetailScreen
          id={selectedId}
          onBack={() => setSelectedId(null)}
          theme={theme}
          onToggleTheme={toggle}
        />
      ) : (
        <LedgerScreen theme={theme} onToggleTheme={toggle} onSelect={setSelectedId} />
      )}
    </div>
  );
}
