import { useEffect, useState } from 'react';
import { searchEverything, searchKindLabels, type SearchHit } from '../lib/search';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import { useT } from '../lib/i18n';

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
  const t = useT();
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
          <div className="serif page-title">{t('search.title')}</div>
          <div className="page-sub">{t('search.hint')}</div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label={t('theme.toggle')}>
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
          placeholder={t('search.subtitle')}
          aria-label={t('search.aria')}
          autoFocus
          style={{ width: '100%', paddingLeft: 36 }}
        />
      </div>

      {query.trim().length === 0 ? (
        <div className="state">{t('search.hint')}</div>
      ) : searching && hits.length === 0 ? (
        <div className="state">{t('search.searching')}</div>
      ) : hits.length === 0 ? (
        <div className="state">{t('search.nothing')}</div>
      ) : (
        <>
          <div className="section-label">{t('search.found', { n: hits.length })}</div>
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
                <span className="list-row-meta">{t(searchKindLabels[hit.kind])}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
