import { Icon } from './Icon';
import { useT } from '../lib/i18n';

/** Разделы держат ключ сообщения, а не готовую подпись: подпись зависит от языка, порядок — нет. */
const items = [
  { key: 'today', icon: 'sun', label: 'nav.today' },
  { key: 'ledger', icon: 'folders', label: 'nav.ledger' },
  { key: 'household', icon: 'home', label: 'nav.household' },
  { key: 'decisions', icon: 'scale', label: 'nav.decisions' },
  { key: 'navigator', icon: 'compass', label: 'nav.navigator' },
  { key: 'search', icon: 'search', label: 'nav.search' },
] as const;

export function Sidebar({ active, onNavigate }: { active: string; onNavigate: (key: string) => void }) {
  const t = useT();
  return (
    <nav className="rail" aria-label={t('nav.aria')}>
      <div className="rail-logo" aria-hidden="true">
        <Icon name="inner-shadow-top-left" />
      </div>
      {items.map((it) => (
        <button
          key={it.key}
          className={`rail-item${it.key === active ? ' active' : ''}`}
          title={t(it.label)}
          aria-label={t(it.label)}
          aria-current={it.key === active ? 'page' : undefined}
          onClick={() => onNavigate(it.key)}
        >
          <Icon name={it.icon} />
        </button>
      ))}
      <div className="rail-spacer" />
      <button
        className={`rail-avatar${active === 'settings' ? ' active' : ''}`}
        title={t('nav.settings')}
        aria-label={t('nav.settings')}
        aria-current={active === 'settings' ? 'page' : undefined}
        onClick={() => onNavigate('settings')}
      >
        <Icon name="settings" />
      </button>
    </nav>
  );
}
