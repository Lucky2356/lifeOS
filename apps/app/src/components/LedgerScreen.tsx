import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  daysLeftInTrash,
  objectTypeLabels,
  trashRetentionDays,
  type LifeObject,
  type ObjectType,
} from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { compareText } from '../lib/format';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { matchesQuery } from '../lib/ledger-search';
import { AddObjectModal } from './AddObjectModal';
import { ConfirmDialog } from './Dialog';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import { useLocale, useT } from '../lib/i18n';

/** Что показывает список: активное, архив или корзину. */
type Scope = 'active' | 'archive' | 'trash';

/** Подпись под заголовком и текст пустоты зависят от раздела — ключи выбираются здесь, а не в разметке. */
function countKey(scope: Scope) {
  if (scope === 'trash') return 'ledger.countTrash';
  return scope === 'archive' ? 'ledger.countArchive' : 'ledger.countActive';
}

function emptyKey(scope: Scope) {
  if (scope === 'trash') return 'ledger.trashEmpty';
  return scope === 'archive' ? 'ledger.archiveEmpty' : 'ledger.nothingFound';
}

export function LedgerScreen({
  theme,
  onToggleTheme,
  onSelect,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [objects, setObjects] = useState<LifeObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ObjectType | 'all'>('all');
  const [scope, setScope] = useState<Scope>('active');
  const [trash, setTrash] = useState<LifeObject[]>([]);
  const [purging, setPurging] = useState<LifeObject | null>(null);

  const showArchive = scope === 'archive';

  // Архив держим отдельно: в общем списке ему не место, но и терять его нельзя.
  const inScope = useMemo(
    () =>
      scope === 'trash' ? trash : (objects ?? []).filter((o) => (o.status === 'archived') === showArchive),
    [objects, trash, scope, showArchive],
  );
  const archivedCount = useMemo(
    () => (objects ?? []).filter((o) => o.status === 'archived').length,
    [objects],
  );

  // Типы, реально присутствующие в текущем разделе — из них строим чипы-фильтры.
  const presentTypes = useMemo(() => {
    const set = new Set<ObjectType>(inScope.map((o) => o.type));
    return [...set].sort((a, b) => compareText(objectTypeLabels[a][locale], objectTypeLabels[b][locale]));
    // locale в зависимостях не для красоты: без него смена языка оставила бы прежний порядок чипов.
  }, [inScope, locale]);

  const filtered = useMemo(
    () => inScope.filter((o) => (typeFilter === 'all' || o.type === typeFilter) && matchesQuery(o, query)),
    [inScope, typeFilter, query],
  );

  const load = useCallback(() => {
    setError(null);
    ledgerStore
      .list()
      .then(setObjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('ledger.loadFailed')));
    // Корзина живёт отдельно от списка: в `list()` удалённого нет и быть не должно.
    void ledgerStore
      .deleted()
      .then(setTrash)
      .catch(() => setTrash([]));
  }, []);

  useEffect(() => load(), [load]);

  async function restore(id: string) {
    await ledgerStore.restore(id);
    load();
  }

  async function purge(id: string) {
    setPurging(null);
    await ledgerStore.purge(id);
    load();
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">{t('ledger.title')}</div>
          <div className="page-sub">
            {objects === null ? t('app.loading') : t(countKey(scope), { n: inScope.length })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={onToggleTheme}
            aria-label={t('theme.toggle')}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            {t('ledger.add')}
          </button>
        </div>
      </div>

      {/* Поиск и фильтры нужны и тогда, когда активных объектов нет: иначе из пустого реестра
          не добраться до корзины, где лежит только что удалённое. */}
      {objects && (objects.length > 0 || trash.length > 0) && (
        <>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Icon
              name="search"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ink-3)',
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('ledger.search')}
              aria-label={t('ledger.search')}
              style={{ width: '100%', paddingLeft: 34 }}
            />
          </div>
          <div className="filters">
            <button
              className={`chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              {t('ledger.allTypes')}
            </button>
            {presentTypes.map((t) => (
              <button
                key={t}
                className={`chip ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {objectTypeLabels[t].ru}
              </button>
            ))}
            {(archivedCount > 0 || showArchive) && (
              <button
                className={`chip chip-archive ${showArchive ? 'active' : ''}`}
                onClick={() => {
                  // Наборы типов у активных и архива разные — сбрасываем, чтобы не выбрать пустоту.
                  setTypeFilter('all');
                  setScope((v) => (v === 'archive' ? 'active' : 'archive'));
                }}
                aria-pressed={showArchive}
              >
                {showArchive ? t('ledger.toActive') : t('ledger.archive', { n: archivedCount })}
              </button>
            )}
            {(trash.length > 0 || scope === 'trash') && (
              <button
                className={`chip chip-archive ${scope === 'trash' ? 'active' : ''}`}
                onClick={() => {
                  setTypeFilter('all');
                  setScope((v) => (v === 'trash' ? 'active' : 'trash'));
                }}
                aria-pressed={scope === 'trash'}
              >
                {scope === 'trash' ? t('ledger.toActive') : t('ledger.trash', { n: trash.length })}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="state">
          {t('ledger.readFailed')}
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={load}>
              {t('ledger.retry')}
            </button>
          </div>
        </div>
      )}

      {!error && objects !== null && objects.length === 0 && scope !== 'trash' && (
        <div className="state">
          {t('ledger.empty')}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              {t('ledger.addFirst')}
            </button>
          </div>
        </div>
      )}

      {!error && objects && (objects.length > 0 || scope === 'trash') && filtered.length === 0 && (
        <div className="state">{t(emptyKey(scope))}</div>
      )}

      {!error && objects && filtered.length > 0 && scope !== 'trash' && (
        <div className="grid">
          {filtered.map((o) => {
            const pill = lifecyclePill(o);
            return (
              <button key={o.id} className="card" onClick={() => onSelect(o.id)}>
                <div className="card-top">
                  <span className="icon-chip">
                    <Icon name={typeIcons[o.type]} />
                  </span>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                </div>
                <div className="card-title">{o.title}</div>
                <div className="card-meta">{objectTypeLabels[o.type].ru}</div>
              </button>
            );
          })}
        </div>
      )}

      {scope === 'trash' && filtered.length > 0 && (
        <>
          <div className="note" style={{ marginBottom: 14 }}>
            {t('ledger.trashNote', { days: trashRetentionDays })}
          </div>
          <div className="list-card">
            {filtered.map((o) => {
              const left = daysLeftInTrash(o) ?? 0;
              return (
                <div className="list-row" key={o.id} style={{ flexWrap: 'wrap', gap: 10 }}>
                  <span className="icon-chip" style={{ width: 32, height: 32, fontSize: 16 }}>
                    <Icon name={typeIcons[o.type]} />
                  </span>
                  <span style={{ flex: 1, minWidth: 160 }}>
                    <span style={{ fontWeight: 500 }}>{o.title}</span>
                    <span className="page-sub"> · {objectTypeLabels[o.type][locale]}</span>
                  </span>
                  <span className="list-row-meta">
                    {left === 0 ? t('ledger.purgeToday') : t('ledger.purgeIn', { n: left })}
                  </span>
                  <button
                    className="btn"
                    onClick={() => void restore(o.id)}
                    aria-label={t('ledger.restoreOne', { title: o.title })}
                  >
                    {t('ledger.restore')}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setPurging(o)}
                    aria-label={t('ledger.purgeOne', { title: o.title })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {purging && (
        <ConfirmDialog
          title={t('ledger.purgeTitle', { title: purging.title })}
          message={t('ledger.purgeMessage')}
          confirmLabel={t('ledger.purgeConfirm')}
          danger
          onConfirm={() => void purge(purging.id)}
          onCancel={() => setPurging(null)}
        />
      )}

      {adding && (
        <AddObjectModal
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </main>
  );
}
