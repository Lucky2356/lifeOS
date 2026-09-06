import { useCallback, useEffect, useState } from 'react';
import { objectTypeLabels, pickText, type Playbook, type PlaybookProgress } from '@life-os/domain';
import { ledgerStore, navigatorStore as contentApi } from '../lib/store';
import { counted } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';
import { Icon } from './Icon';

function ThemeBtn({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button className="btn" onClick={onToggle} aria-label="Переключить тему">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/** Сколько шагов отмечено — считается по актуальному плейбуку, а не по записи прогресса. */
function doneCount(progress: PlaybookProgress): number {
  return Object.values(progress.stepStates).filter(Boolean).length;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sage)' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
        {done} из {counted(total, 'шага', 'шагов', 'шагов')}
      </span>
    </div>
  );
}

export function NavigatorScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [progress, setProgress] = useState<PlaybookProgress | null>(null);
  /** Прогресс по всем начатым плейбукам — чтобы список показывал, за что уже брались. */
  const [started, setStarted] = useState<Map<string, PlaybookProgress>>(new Map());
  /**
   * Из какого плейбука открыт встроенный гид. Гид — это обычный плейбук, но пришли в него из шага,
   * и «Назад» обязано вернуть туда же, а не в общий список.
   */
  const [parentKey, setParentKey] = useState<string | null>(null);
  /**
   * Какие типы документов уже есть в реестре. null означает «прочитать не удалось» — это не то же
   * самое, что «ничего нет»: сказать человеку в кризисе, что у него нет паспорта, хуже, чем
   * промолчать.
   */
  const [ownedTypes, setOwnedTypes] = useState<Set<string> | null>(new Set());
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPlaybooks(contentApi.playbooks());
    void contentApi
      .progress()
      .then((all) => setStarted(new Map(all.map((p) => [p.playbookKey, p]))))
      .catch(() => setError('Не удалось прочитать сохранённый прогресс.'));
  }, []);
  useEffect(() => load(), [load]);

  useEffect(() => {
    void ledgerStore
      .list()
      .then((objects) =>
        setOwnedTypes(new Set(objects.filter((o) => o.status === 'active').map((o) => o.type))),
      )
      .catch(() => setOwnedTypes(null));
  }, []);

  async function open(pb: Playbook, from: string | null = null) {
    try {
      setSelected(contentApi.playbook(pb.key));
      setParentKey(from);
      setProgress(await contentApi.start(pb.key));
      setError(null);
    } catch {
      setError('Не удалось открыть плейбук.');
    }
  }

  function back() {
    const parent = parentKey ? playbooks.find((p) => p.key === parentKey) : null;
    if (parent) {
      void open(parent);
      return;
    }
    setSelected(null);
    setProgress(null);
    setParentKey(null);
    load();
  }

  /**
   * Встроенный гид открывается как обычный плейбук. Если в паке такого ключа нет, пилюли не будет
   * вовсе — ссылка в никуда хуже её отсутствия.
   */
  const guideFor = (key: string | null) => (key ? (playbooks.find((p) => p.key === key) ?? null) : null);

  async function toggle(stepKey: string) {
    if (!progress) return;
    try {
      setProgress(await contentApi.toggleStep(progress.id, stepKey));
      setError(null);
    } catch {
      setError('Не удалось сохранить отметку — попробуйте ещё раз.');
    }
  }

  async function reset() {
    if (!selected) return;
    setConfirmReset(false);
    try {
      await contentApi.reset(selected.key);
      setProgress(await contentApi.start(selected.key));
    } catch {
      setError('Не удалось начать заново.');
    }
  }

  const crisis = playbooks.filter((p) => p.kind === 'crisis');
  const bureaucracy = playbooks.filter((p) => p.kind === 'bureaucracy');

  const errorNote = error && (
    <div className="page-sub" role="status" style={{ color: 'var(--brick-ink)', marginBottom: 12 }}>
      {error}
    </div>
  );

  if (selected && progress) {
    const done = doneCount(progress);
    return (
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={back}>
            <Icon name="arrow-left" />{' '}
            {parentKey ? pickText(contentApi.playbook(parentKey).title, 'ru') : 'Навигатор'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {done > 0 && (
              <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                Начать заново
              </button>
            )}
            <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>

        <div className="serif page-title">{pickText(selected.title, 'ru')}</div>
        <div className="page-sub" style={{ marginBottom: 16 }}>
          {pickText(selected.summary, 'ru')}
        </div>

        {errorNote}

        <div style={{ marginBottom: 22 }}>
          <ProgressBar done={done} total={selected.steps.length} />
        </div>

        {selected.steps.map((step) => {
          const stepDone = progress.stepStates[step.key] ?? false;
          return (
            <div className="step-card" key={step.key}>
              <button
                className={`check ${stepDone ? 'check-done' : ''}`}
                onClick={() => void toggle(step.key)}
                aria-label={stepDone ? 'Снять отметку' : 'Отметить готовым'}
              >
                {stepDone && <Icon name="check" />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 500,
                      textDecoration: stepDone ? 'line-through' : 'none',
                      color: stepDone ? 'var(--ink-3)' : 'var(--ink)',
                    }}
                  >
                    {pickText(step.title, 'ru')}
                  </span>
                  {guideFor(step.embedsGuideKey) && (
                    <button
                      className="pill pill-ok"
                      style={{ border: 'none', cursor: 'pointer', font: 'inherit' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const guide = guideFor(step.embedsGuideKey);
                        if (guide) void open(guide, selected.key);
                      }}
                    >
                      Открыть гид
                    </button>
                  )}
                </div>
                <div className="page-sub" style={{ marginTop: 4 }}>
                  {pickText(step.description, 'ru')}
                </div>
                {step.requiredDocumentTypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {step.requiredDocumentTypes.map((t) => {
                      // Смысл Навигатора — не перечислить нужные бумаги, а сказать, чего у вас нет.
                      // Но только когда реестр действительно прочитан: иначе пилюля молчит о наличии.
                      const owned = ownedTypes?.has(t) ?? false;
                      const unknown = ownedTypes === null;
                      return (
                        <span
                          key={t}
                          className={`pill ${unknown ? '' : owned ? 'pill-ok' : 'pill-due'}`}
                          title={
                            unknown ? 'Реестр не прочитан' : owned ? 'Есть в реестре' : 'В реестре не нашлось'
                          }
                        >
                          <Icon name={owned ? 'check' : 'file'} style={{ marginRight: 4 }} />
                          {objectTypeLabels[t].ru}
                          {unknown ? '' : owned ? ' · есть' : ' · нужно оформить'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {confirmReset && (
          <ConfirmDialog
            title={`Начать «${pickText(selected.title, 'ru')}» заново?`}
            message="Отметки по всем шагам будут сняты. Сам плейбук и его содержание не изменятся."
            confirmLabel="Начать заново"
            onConfirm={() => void reset()}
            onCancel={() => setConfirmReset(false)}
          />
        )}
      </main>
    );
  }

  function section(title: string, list: Playbook[], icon: 'compass' | 'file-text') {
    // Заголовок над пустотой ничего не сообщает: секция появляется вместе с плейбуками.
    if (list.length === 0) return null;
    return (
      <>
        <div className="section-label">{title}</div>
        <div className="grid" style={{ marginBottom: 24 }}>
          {list.map((pb) => {
            const inProgress = started.get(pb.key);
            return (
              <button key={pb.key} className="card" onClick={() => void open(pb)}>
                <div className="card-top">
                  <span className="icon-chip">
                    <Icon name={icon} />
                  </span>
                </div>
                <div className="card-title">{pickText(pb.title, 'ru')}</div>
                {inProgress ? (
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar done={doneCount(inProgress)} total={pb.steps.length} />
                  </div>
                ) : (
                  <div className="card-meta">{counted(pb.steps.length, 'шаг', 'шага', 'шагов')}</div>
                )}
              </button>
            );
          })}
        </div>
      </>
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

      {errorNote}
      {section('Кризисные ситуации', crisis, 'compass')}
      {section('Бюрократия', bureaucracy, 'file-text')}
    </main>
  );
}
