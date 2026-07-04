import { useCallback, useEffect, useState } from 'react';
import {
  objectTypeLabels,
  pickText,
  progressPercent,
  type Playbook,
  type PlaybookProgress,
} from '@life-os/domain';
import { contentApi } from '../lib/content-api';
import type { Theme } from '../lib/theme';

function ThemeBtn({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="btn" onClick={onToggle} aria-label="Переключить тему">
      <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
    </button>
  );
}

export function NavigatorScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [progress, setProgress] = useState<PlaybookProgress | null>(null);

  const load = useCallback(() => {
    void contentApi.playbooks().then(setPlaybooks);
  }, []);
  useEffect(() => load(), [load]);

  async function open(pb: Playbook) {
    const [full, prog] = await Promise.all([contentApi.playbook(pb.key), contentApi.start(pb.key)]);
    setSelected(full);
    setProgress(prog);
  }

  async function toggle(stepKey: string) {
    if (!progress) return;
    const updated = await contentApi.toggleStep(progress.id, stepKey);
    setProgress(updated);
  }

  const crisis = playbooks.filter((p) => p.kind === 'crisis');
  const bureaucracy = playbooks.filter((p) => p.kind === 'bureaucracy');

  if (selected && progress) {
    const pct = Math.round(progressPercent(progress) * 100);
    const doneCount = Object.values(progress.stepStates).filter(Boolean).length;
    return (
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Навигатор
          </button>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
        </div>

        <div className="serif page-title">{pickText(selected.title, 'ru')}</div>
        <div className="page-sub" style={{ marginBottom: 16 }}>{pickText(selected.summary, 'ru')}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sage)' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            {doneCount} из {selected.steps.length} шагов
          </span>
        </div>

        {selected.steps.map((step) => {
          const done = progress.stepStates[step.key] ?? false;
          return (
            <div className="step-card" key={step.key}>
              <button
                className={`check ${done ? 'check-done' : ''}`}
                onClick={() => toggle(step.key)}
                aria-label={done ? 'Снять отметку' : 'Отметить готовым'}
              >
                {done && <i className="ti ti-check" aria-hidden="true" />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--ink-3)' : 'var(--ink)' }}>
                    {pickText(step.title, 'ru')}
                  </span>
                  {step.embedsGuideKey && <span className="pill pill-ok">Гид</span>}
                </div>
                <div className="page-sub" style={{ marginTop: 4 }}>{pickText(step.description, 'ru')}</div>
                {step.requiredDocumentTypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {step.requiredDocumentTypes.map((t) => (
                      <span key={t} className="pill pill-none">
                        <i className="ti ti-file" aria-hidden="true" style={{ marginRight: 4 }} />
                        {objectTypeLabels[t].ru}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Навигатор</div>
          <div className="page-sub">Плейбуки трудных ситуаций и бюрократические гиды</div>
        </div>
        <ThemeBtn theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="section-label">Кризисные ситуации</div>
      <div className="grid" style={{ marginBottom: 24 }}>
        {crisis.map((pb) => (
          <button key={pb.key} className="card" onClick={() => open(pb)}>
            <div className="card-top">
              <span className="icon-chip"><i className="ti ti-compass" aria-hidden="true" /></span>
            </div>
            <div className="card-title">{pickText(pb.title, 'ru')}</div>
            <div className="card-meta">{pb.steps.length} шагов</div>
          </button>
        ))}
      </div>

      <div className="section-label">Бюрократия</div>
      <div className="grid">
        {bureaucracy.map((pb) => (
          <button key={pb.key} className="card" onClick={() => open(pb)}>
            <div className="card-top">
              <span className="icon-chip"><i className="ti ti-file-text" aria-hidden="true" /></span>
            </div>
            <div className="card-title">{pickText(pb.title, 'ru')}</div>
            <div className="card-meta">{pb.steps.length} шагов</div>
          </button>
        ))}
      </div>
    </main>
  );
}
