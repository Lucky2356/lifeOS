const items = [
  { key: 'today', icon: 'ti-sun', label: 'Сегодня' },
  { key: 'ledger', icon: 'ti-folders', label: 'Реестр' },
  { key: 'household', icon: 'ti-home', label: 'Дом' },
  { key: 'decisions', icon: 'ti-scale', label: 'Решения' },
  { key: 'navigator', icon: 'ti-compass', label: 'Навигатор' },
];

export function Sidebar({ active, onNavigate }: { active: string; onNavigate: (key: string) => void }) {
  return (
    <nav className="rail" aria-label="Основная навигация">
      <div className="rail-logo" aria-hidden="true">
        <i className="ti ti-inner-shadow-top-left" />
      </div>
      {items.map((it) => (
        <button
          key={it.key}
          className={`rail-item${it.key === active ? ' active' : ''}`}
          title={it.label}
          aria-label={it.label}
          aria-current={it.key === active ? 'page' : undefined}
          onClick={() => onNavigate(it.key)}
        >
          <i className={`ti ${it.icon}`} aria-hidden="true" />
        </button>
      ))}
      <div className="rail-spacer" />
      <div className="rail-avatar" title="Профиль">
        А
      </div>
    </nav>
  );
}
