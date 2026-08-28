import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  daysLeftInTrash,
  objectTypeLabels,
  trashRetentionDays,
  type LifeObject,
  type ObjectType,
} from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { counted } from '../lib/format';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { matchesQuery } from '../lib/ledger-search';
import { AddObjectModal } from './AddObjectModal';
import { ConfirmDialog } from './Dialog';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

/** Что показывает список: активное, архив или корзину. */
type Scope = 'active' | 'archive' | 'trash';

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
          <div className="serif page-title">Реестр</div>
          <div className="page-sub">
            {objects === null
              ? 'Загрузка…'
              : scope === 'trash'
                ? `${counted(inScope.length, 'объект', 'объекта', 'объектов')} в корзине`
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
                  setScope((v) => (v === 'archive' ? 'active' : 'archive'));
                }}
                aria-pressed={showArchive}
              >
                {showArchive ? 'К активным' : `Архив · ${archivedCount}`}
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
                {scope === 'trash' ? 'К активным' : `Корзина · ${trash.length}`}
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

      {!error && objects !== null && objects.length === 0 && scope !== 'trash' && (
        <div className="state">
          Здесь появятся ваши документы, вещи и подписки.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Добавить первый объект
            </button>
          </div>
        </div>
      )}

      {!error && objects && (objects.length > 0 || scope === 'trash') && filtered.length === 0 && (
        <div className="state">
          {scope === 'trash'
            ? 'В корзине ничего нет.'
            : showArchive
              ? 'В архиве ничего не найдено.'
              : 'Ничего не найдено. Измените запрос или фильтр.'}
        </div>
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
            Удалённое лежит здесь {trashRetentionDays} дней вместе с приложенными файлами. Потом исчезает
            окончательно — восстанавливать будет неоткуда.
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
                    <span className="page-sub"> · {objectTypeLabels[o.type].ru}</span>
                  </span>
                  <span className="list-row-meta">
                    {left === 0 ? 'удалится сегодня' : `${left} дн. до удаления`}
                  </span>
                  <button
                    className="btn"
                    onClick={() => void restore(o.id)}
                    aria-label={`Восстановить «${o.title}»`}
                  >
                    Восстановить
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => setPurging(o)}
                    aria-label={`Удалить «${o.title}» окончательно`}
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
          title={`Удалить «${purging.title}» окончательно?`}
          message="Объект и приложенные к нему файлы исчезнут с устройства. Вернуть их можно будет только из резервной копии, сделанной раньше."
          confirmLabel="Удалить навсегда"
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
