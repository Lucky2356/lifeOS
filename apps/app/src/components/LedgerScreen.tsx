import { useCallback, useEffect, useMemo, useState } from 'react';
import { objectTypeLabels, type LifeObject, type ObjectType } from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { counted } from '../lib/format';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { matchesQuery } from '../lib/ledger-search';
import { AddObjectModal } from './AddObjectModal';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

export function LedgerScreen({
  theme,
  onToggleTheme,
  onSelect,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onSelect: (id: string) => void;
}) {
  const [objects, setObjects] = useState<LifeObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ObjectType | 'all'>('all');
  const [showArchive, setShowArchive] = useState(false);

  // Архив держим отдельно: в общем списке ему не место, но и терять его нельзя.
  const inScope = useMemo(
    () => (objects ?? []).filter((o) => (o.status === 'archived') === showArchive),
    [objects, showArchive],
  );
  const archivedCount = useMemo(
    () => (objects ?? []).filter((o) => o.status === 'archived').length,
    [objects],
  );

  // Типы, реально присутствующие в текущем разделе — из них строим чипы-фильтры.
  const presentTypes = useMemo(() => {
    const set = new Set<ObjectType>(inScope.map((o) => o.type));
    return [...set].sort((a, b) => objectTypeLabels[a].ru.localeCompare(objectTypeLabels[b].ru));
  }, [inScope]);

  const filtered = useMemo(
    () => inScope.filter((o) => (typeFilter === 'all' || o.type === typeFilter) && matchesQuery(o, query)),
    [inScope, typeFilter, query],
  );

  const load = useCallback(() => {
    setError(null);
    ledgerStore
      .list()
      .then(setObjects)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Реестр</div>
          <div className="page-sub">
            {objects === null
              ? 'Загрузка…'
              : showArchive
                ? `${counted(inScope.length, 'объект', 'объекта', 'объектов')} в архиве`
                : `${counted(inScope.length, 'объект', 'объекта', 'объектов')} вашей жизни`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={onToggleTheme}
            aria-label="Переключить тему"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" />
            Добавить
          </button>
        </div>
      </div>

      {objects && objects.length > 0 && (
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
              placeholder="Поиск по реестру"
              aria-label="Поиск по реестру"
              style={{ width: '100%', paddingLeft: 34 }}
            />
          </div>
          <div className="filters">
            <button
              className={`chip ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              Все
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
                  setShowArchive((v) => !v);
                }}
                aria-pressed={showArchive}
              >
                {showArchive ? 'К активным' : `Архив · ${archivedCount}`}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="state">
          Не удалось прочитать данные на этом устройстве.
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={load}>
              Повторить
            </button>
          </div>
        </div>
      )}

      {!error && objects !== null && objects.length === 0 && (
        <div className="state">
          Здесь появятся ваши документы, вещи и подписки.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Добавить первый объект
            </button>
          </div>
        </div>
      )}

      {!error && objects && objects.length > 0 && filtered.length === 0 && (
        <div className="state">
          {showArchive ? 'В архиве ничего не найдено.' : 'Ничего не найдено. Измените запрос или фильтр.'}
        </div>
      )}

      {!error && objects && filtered.length > 0 && (
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
