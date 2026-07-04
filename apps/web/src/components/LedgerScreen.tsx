import { useCallback, useEffect, useState } from 'react';
import { objectTypeLabels, type LifeObject } from '@life-os/domain';
import { api } from '../lib/api';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { AddObjectModal } from './AddObjectModal';
import type { Theme } from '../lib/theme';

export function LedgerScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [objects, setObjects] = useState<LifeObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api
      .listObjects()
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
            {objects === null ? 'Загрузка…' : `${objects.length} объектов вашей жизни`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={onToggleTheme}
            aria-label="Переключить тему"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            Добавить
          </button>
        </div>
      </div>

      <div className="filters">
        <span className="chip active">Все</span>
        <span className="chip">Документы</span>
        <span className="chip">Вещи</span>
        <span className="chip">Подписки</span>
        <span className="chip">Страховки</span>
        <span className="chip">Здоровье</span>
        <span className="chip">Финансы</span>
      </div>

      {error && (
        <div className="state">
          Не удалось загрузить реестр. Проверьте, что сервер запущен.
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

      {!error && objects && objects.length > 0 && (
        <div className="grid">
          {objects.map((o) => {
            const pill = lifecyclePill(o);
            return (
              <button key={o.id} className="card">
                <div className="card-top">
                  <span className="icon-chip">
                    <i className={`ti ${typeIcons[o.type]}`} aria-hidden="true" />
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
