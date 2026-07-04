import { Sidebar } from './components/Sidebar';
import { LedgerScreen } from './components/LedgerScreen';
import { useTheme } from './lib/theme';

export function App() {
  const { theme, toggle } = useTheme();
  return (
    <div className="app">
      <Sidebar active="ledger" />
      <LedgerScreen theme={theme} onToggleTheme={toggle} />
    </div>
  );
}
