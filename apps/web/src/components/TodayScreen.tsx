import { useEffect, useState } from 'react';
import {
  daysUntil,
  lifecycleFor,
  objectTypeLabels,
  type HouseholdTask,
  type LifeObject,
} from '@life-os/domain';
import { api } from '../lib/api';
import { householdApi } from '../lib/household-api';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import type { Theme } from '../lib/theme';

const order = { overdue: 0, due_soon: 1, ok: 2, none: 3 } as const;

export function TodayScreen({
  theme,
  onToggleTheme,
  onOpenObject,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenObject: (id: string) => void;
}) {
  const [attention, setAttention] = useState<LifeObject[] | null>(null);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);

  useEffect(() => {
    void api.listObjects().then((objects) => {
      const flagged = objects
        .filter((o) => {
          const s = lifecycleFor(o.validUntil);
          return s === 'overdue' || s === 'due_soon';
        })
        .sort((a, b) => {
          const sa = order[lifecycleFor(a.validUntil)];
          const sb = order[lifecycleFor(b.validUntil)];
          if (sa !== sb) return sa - sb;
          return (daysUntil(a.validUntil) ?? 0) - (daysUntil(b.validUntil) ?? 0);
        });
      setAttention(flagged);
    });
    void householdApi.listMine().then((hs) => {
      const first = hs[0];
      if (first) void householdApi.tasks(first.id).then((t) => setTasks(t.filter((x) => x.status === 'open')));
    });
  }, []);

  const count = attention?.length ?? 0;

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="page-sub" style={{ marginBottom: 2 }}>
            {new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </div>
          <div className="serif page-title">Доброе утро</div>
          <div className="page-sub" style={{ marginTop: 4 }}>
            {attention === null
              ? 'Загрузка…'
              : count === 0
                ? 'Всё под контролем. Ничего срочного.'
                : `${count} ${count === 1 ? 'дело просит' : 'дел просят'} внимания. Остальное под контролем.`}
          </div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      {count > 0 && (
        <>
          <div className="section-label">Требует внимания</div>
          <div className="list-card" style={{ marginBottom: 22 }}>
            {attention!.map((o) => {
              const pill = lifecyclePill(o);
              return (
                <button
                  key={o.id}
                  className="list-row"
                  onClick={() => onOpenObject(o.id)}
                  style={{ width: '100%', background: 'none', border: 'none', borderBottom: '0.5px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span className="icon-chip" style={{ width: 32, height: 32, fontSize: 16 }}>
                    <i className={`ti ${typeIcons[o.type]}`} aria-hidden="true" />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{o.title}</span>
                    <span className="page-sub"> · {objectTypeLabels[o.type].ru}</span>
                  </span>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-label">Дом · задачи</div>
          <div className="list-card">
            {tasks.map((t) => (
              <div className="list-row" key={t.id}>
                <span className="check" aria-hidden="true" />
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {attention !== null && count === 0 && tasks.length === 0 && (
        <div className="state">Спокойный день — система держит ваши дела под контролем.</div>
      )}
    </main>
  );
}
