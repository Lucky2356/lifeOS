import { useEffect, useState } from 'react';
import { counted } from '../lib/format';
import { searchEverything, searchKindLabels, type SearchHit } from '../lib/search';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

const kindIcons: Record<SearchHit['kind'], string> = {
  object: 'folders',
  task: 'home',
  decision: 'scale',
  playbook: 'compass',
};

/** Поиск сразу по всем модулям: человек ищет «ОСАГО», а не «объект реестра типа страховка». */
export function SearchScreen({
  theme,
  onToggleTheme,
  onOpenObject,
  onOpenSection,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenObject: (id: string) => void;
  onOpenSection: (kind: SearchHit['kind']) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    // Небольшая пауза, чтобы не перебирать хранилище на каждую букву.
    const timer = setTimeout(() => {
      void searchEverything(query)
        .then((found) => {
          if (!cancelled) setHits(found);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Поиск</div>
          <div className="page-sub">По реестру, дому, решениям и плейбукам</div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
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
          placeholder="Что ищем?"
          aria-label="Поиск по приложению"
          autoFocus
          style={{ width: '100%', paddingLeft: 36 }}
        />
      </div>

      {query.trim().length === 0 ? (
        <div className="state">Начните вводить — найдём во всех разделах сразу.</div>
      ) : searching && hits.length === 0 ? (
        <div className="state">Ищем…</div>
      ) : hits.length === 0 ? (
        <div className="state">Ничего не нашлось.</div>
      ) : (
        <>
          <div className="section-label">{counted(hits.length, 'находка', 'находки', 'находок')}</div>
          <div className="list-card">
            {hits.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                className="list-row"
                onClick={() => (hit.kind === 'object' ? onOpenObject(hit.id) : onOpenSection(hit.kind))}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <Icon name={kindIcons[hit.kind]} style={{ color: 'var(--sage)' }} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{hit.title}</span>
                  <span className="page-sub"> · {hit.subtitle}</span>
                </span>
                <span className="list-row-meta">{searchKindLabels[hit.kind]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
