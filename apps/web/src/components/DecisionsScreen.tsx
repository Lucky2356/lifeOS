import { useCallback, useEffect, useState } from 'react';
import {
  scoreOptions,
  type Decision,
  type DecisionCriterion,
  type DecisionOption,
} from '@life-os/domain';
import { decisionApi } from '../lib/decision-api';
import type { Theme } from '../lib/theme';

function ThemeBtn({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="btn" onClick={onToggle} aria-label="Переключить тему">
      <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
    </button>
  );
}

export function DecisionsScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [options, setOptions] = useState<DecisionOption[]>([]);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    void decisionApi.list().then(setDecisions);
  }, []);
  useEffect(() => load(), [load]);

  function open(d: Decision) {
    setSelected(d);
    setCriteria(d.criteria);
    setOptions(d.options);
    setDirty(false);
  }

  async function createNew() {
    const title = window.prompt('О чём решение?');
    if (!title) return;
    const d = await decisionApi.create({ title });
    load();
    open(d);
  }

  async function save() {
    if (!selected) return;
    const updated = await decisionApi.update(selected.id, { criteria, options });
    setSelected(updated);
    setDirty(false);
    load();
  }

  function addCriterion() {
    setCriteria((c) => [...c, { id: crypto.randomUUID(), label: 'Новый критерий', weight: 3 }]);
    setDirty(true);
  }
  function addOption() {
    setOptions((o) => [...o, { id: crypto.randomUUID(), label: 'Новый вариант', scores: {} }]);
    setDirty(true);
  }
  function setScore(optId: string, critId: string, value: number) {
    setOptions((os) => os.map((o) => (o.id === optId ? { ...o, scores: { ...o.scores, [critId]: value } } : o)));
    setDirty(true);
  }

  const ranked = scoreOptions({ criteria, options });

  if (selected) {
    return (
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Решения
          </button>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="serif page-title" style={{ marginBottom: 18 }}>{selected.title}</div>

        <div className="section-label">
          Критерии
          <button className="reveal-btn" onClick={addCriterion}>
            <i className="ti ti-plus" aria-hidden="true" /> добавить
          </button>
        </div>
        <div className="list-card" style={{ marginBottom: 20 }}>
          {criteria.length === 0 && <div className="list-row" style={{ color: 'var(--ink-3)' }}>Добавьте критерии</div>}
          {criteria.map((c) => (
            <div className="list-row" key={c.id}>
              <input
                className="inline-input"
                value={c.label}
                onChange={(e) => {
                  setCriteria((cs) => cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)));
                  setDirty(true);
                }}
              />
              <span className="list-row-meta">вес</span>
              <select
                value={c.weight}
                onChange={(e) => {
                  setCriteria((cs) => cs.map((x) => (x.id === c.id ? { ...x, weight: Number(e.target.value) } : x)));
                  setDirty(true);
                }}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="section-label">
          Варианты
          <button className="reveal-btn" onClick={addOption}>
            <i className="ti ti-plus" aria-hidden="true" /> добавить
          </button>
        </div>
        <div className="list-card" style={{ marginBottom: 20 }}>
          {options.length === 0 && <div className="list-row" style={{ color: 'var(--ink-3)' }}>Добавьте варианты</div>}
          {options.map((o) => (
            <div className="list-row" key={o.id} style={{ flexWrap: 'wrap', gap: 10 }}>
              <input
                className="inline-input"
                value={o.label}
                style={{ minWidth: 140 }}
                onChange={(e) => {
                  setOptions((os) => os.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)));
                  setDirty(true);
                }}
              />
              {criteria.map((c) => (
                <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
                  {c.label}
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={o.scores[c.id] ?? 0}
                    onChange={(e) => setScore(o.id, c.id, Number(e.target.value))}
                    style={{ width: 48 }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>

        {ranked.length > 0 && (
          <>
            <div className="section-label">Взвешенный итог</div>
            <div className="list-card" style={{ marginBottom: 20 }}>
              {ranked.map((r, i) => (
                <div className="list-row" key={r.optionId}>
                  {i === 0 && <i className="ti ti-star" aria-hidden="true" style={{ color: 'var(--sage)' }} />}
                  <span style={{ fontWeight: i === 0 ? 500 : 400 }}>{r.label}</span>
                  <span className="list-row-meta">{r.total} баллов</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="btn btn-primary" onClick={save} disabled={!dirty}>
          {dirty ? 'Сохранить' : 'Сохранено'}
        </button>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Решения</div>
          <div className="page-sub">Взвешивайте варианты и ведите журнал решений</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          <button className="btn btn-primary" onClick={createNew}>
            <i className="ti ti-plus" aria-hidden="true" /> Новое
          </button>
        </div>
      </div>
      {decisions.length === 0 ? (
        <div className="state">Пока нет решений. Создайте первое, когда предстоит выбор.</div>
      ) : (
        <div className="grid">
          {decisions.map((d) => (
            <button key={d.id} className="card" onClick={() => open(d)}>
              <div className="card-top">
                <span className="icon-chip"><i className="ti ti-scale" aria-hidden="true" /></span>
                <span className={`pill ${d.status === 'decided' ? 'pill-ok' : 'pill-none'}`}>
                  {d.status === 'decided' ? 'решено' : 'черновик'}
                </span>
              </div>
              <div className="card-title">{d.title}</div>
              <div className="card-meta">{d.options.length} вар. · {d.criteria.length} крит.</div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
