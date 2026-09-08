import { useCallback, useEffect, useState } from 'react';
import {
  objectTypeLabels,
  pickText,
  type ObjectType,
  type Playbook,
  type PlaybookProgress,
} from '@life-os/domain';
import { ledgerStore, navigatorStore as contentApi } from '../lib/store';
import { useLocale, useT, type TFunction } from '../lib/i18n';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';
import { Icon } from './Icon';

function ThemeBtn({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const t = useT();
  return (
    <button className="btn" onClick={onToggle} aria-label={t('theme.toggle')}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/** Сколько шагов отмечено — считается по актуальному плейбуку, а не по записи прогресса. */
function doneCount(progress: PlaybookProgress): number {
  return Object.values(progress.stepStates).filter(Boolean).length;
}

interface DocPillState {
  cls: string;
  title: string;
  suffix: string;
  icon: 'check' | 'file';
}

/**
 * Состояние пилюли требуемого документа. Состояний три, а не два: реестр мог не прочитаться, и
 * тогда пилюля молчит о наличии. Смысл Навигатора — сказать, чего у вас нет; но сообщить человеку
 * в кризисе, что у него нет паспорта, который у него есть, хуже, чем промолчать.
 */
function docPill(type: ObjectType, owned: Set<string> | null, t: TFunction): DocPillState {
  if (owned === null) {
    return { cls: 'pill', title: t('navigator.docUnknown'), suffix: '', icon: 'file' };
  }
  if (owned.has(type)) {
    return {
      cls: 'pill pill-ok',
      title: t('navigator.docOwned'),
      suffix: t('navigator.docOwnedSuffix'),
      icon: 'check',
    };
  }
  return {
    cls: 'pill pill-due',
    title: t('navigator.docMissing'),
    suffix: t('navigator.docMissingSuffix'),
    icon: 'file',
  };
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const t = useT();
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--sage)' }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
        {t('navigator.progress', { done, n: total })}
      </span>
    </div>
  );
}

export function NavigatorScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const t = useT();
  const locale = useLocale();
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
      .catch(() => setError(t('navigator.progressFailed')));
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
      setError(t('navigator.openFailed'));
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
      setError(t('navigator.toggleFailed'));
    }
  }

  async function reset() {
    if (!selected) return;
    setConfirmReset(false);
    try {
      await contentApi.reset(selected.key);
      setProgress(await contentApi.start(selected.key));
    } catch {
      setError(t('navigator.restartFailed'));
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
            {parentKey ? pickText(contentApi.playbook(parentKey).title, locale) : t('navigator.title')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {done > 0 && (
              <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                {t('navigator.restart')}
              </button>
            )}
            <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>

        <div className="serif page-title">{pickText(selected.title, locale)}</div>
        <div className="page-sub" style={{ marginBottom: 16 }}>
          {pickText(selected.summary, locale)}
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
                aria-label={stepDone ? t('navigator.stepUndone') : t('navigator.stepDone')}
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
                    {pickText(step.title, locale)}
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
                      {t('navigator.openGuide')}
                    </button>
                  )}
                </div>
                <div className="page-sub" style={{ marginTop: 4 }}>
                  {pickText(step.description, locale)}
                </div>
                {step.requiredDocumentTypes.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {step.requiredDocumentTypes.map((type) => {
                      const pill = docPill(type, ownedTypes, t);
                      return (
                        <span key={type} className={pill.cls} title={pill.title}>
                          <Icon name={pill.icon} style={{ marginRight: 4 }} />
                          {objectTypeLabels[type].ru}
                          {pill.suffix}
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
            title={t('navigator.restartTitle', { playbook: pickText(selected.title, locale) })}
            message={t('navigator.restartMessage')}
            confirmLabel={t('navigator.restart')}
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
                <div className="card-title">{pickText(pb.title, locale)}</div>
                {inProgress ? (
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar done={doneCount(inProgress)} total={pb.steps.length} />
                  </div>
                ) : (
                  <div className="card-meta">{t('navigator.stepCount', { n: pb.steps.length })}</div>
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
          <div className="serif page-title">{t('navigator.title')}</div>
          <div className="page-sub">{t('navigator.subtitle')}</div>
        </div>
        <ThemeBtn theme={theme} onToggle={onToggleTheme} />
      </div>

      {errorNote}
      {section(t('navigator.crisis'), crisis, 'compass')}
      {section(t('navigator.bureaucracy'), bureaucracy, 'file-text')}
    </main>
  );
}
