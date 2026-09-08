import { useCallback, useEffect, useState } from 'react';
import {
  decideDecision,
  newDecisionChildId,
  recordOutcome,
  reopenDecision,
  scoreOptions,
  type Decision,
  type DecisionCriterion,
  type DecisionOption,
} from '@life-os/domain';
import { decisionsStore as decisionApi } from '../lib/store';
import { formatDate } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ChoiceDialog, ConfirmDialog, PromptDialog } from './Dialog';
import { Icon } from './Icon';
import { useT } from '../lib/i18n';

function ThemeBtn({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const t = useT();
  return (
    <button className="btn" onClick={onToggle} aria-label={t('theme.toggle')}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export function DecisionsScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const t = useT();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [selected, setSelected] = useState<Decision | null>(null);
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [options, setOptions] = useState<DecisionOption[]>([]);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expected, setExpected] = useState('');
  const [outcome, setOutcome] = useState('');
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [context, setContext] = useState('');
  /** Вариант, который вот-вот зафиксируют: осталось выбрать, когда к нему вернуться. */
  const [deciding, setDeciding] = useState<string | null>(null);

  const load = useCallback(() => {
    void decisionApi.list().then(setDecisions);
  }, []);
  useEffect(() => load(), [load]);

  function open(d: Decision) {
    setSelected(d);
    setCriteria(d.criteria);
    setOptions(d.options);
    setExpected(d.expectedOutcome);
    setContext(d.context);
    setOutcome(d.actualOutcome ?? '');
    setDirty(false);
  }

  async function createNew(title: string) {
    setCreating(false);
    const d = await decisionApi.create({ title });
    load();
    open(d);
  }

  async function save() {
    if (!selected) return;
    const updated = await decisionApi.update(selected.id, {
      criteria,
      options,
      context,
      expectedOutcome: expected,
    });
    setSelected(updated);
    setDirty(false);
    load();
  }

  /** Записать изменение, посчитанное доменом (фиксация решения, исход, возврат в черновик). */
  async function apply(next: Decision) {
    const updated = await decisionApi.update(next.id, {
      status: next.status,
      chosenOptionId: next.chosenOptionId,
      decidedAt: next.decidedAt,
      actualOutcome: next.actualOutcome,
      reviewAt: next.reviewAt,
    });
    setSelected(updated);
    setOutcome(updated.actualOutcome ?? '');
    load();
  }

  async function decide(optionId: string, reviewMonths: number) {
    if (!selected) return;
    // Несохранённые правки матрицы фиксируем вместе с решением, иначе они потеряются.
    const base = dirty
      ? await decisionApi.update(selected.id, { criteria, options, context, expectedOutcome: expected })
      : selected;
    setDirty(false);
    setDeciding(null);
    await apply(decideDecision(base, optionId, reviewMonths));
  }

  async function saveOutcome() {
    if (!selected) return;
    await apply(recordOutcome(selected, outcome.trim()));
  }

  async function removeDecision() {
    if (!selected) return;
    setConfirmDelete(false);
    await decisionApi.remove(selected.id);
    setSelected(null);
    load();
  }

  function removeCriterion(id: string) {
    setCriteria((cs) => cs.filter((c) => c.id !== id));
    // Оценки по удалённому критерию больше ни на что не влияют — убираем, чтобы не копить мусор.
    setOptions((os) =>
      os.map((o) => {
        const { [id]: _dropped, ...rest } = o.scores;
        return { ...o, scores: rest };
      }),
    );
    setDirty(true);
  }

  function removeOption(id: string) {
    setOptions((os) => os.filter((o) => o.id !== id));
    setDirty(true);
  }

  async function reopen() {
    if (!selected) return;
    setConfirmReopen(false);
    await apply(reopenDecision(selected));
  }

  function addCriterion() {
    setCriteria((c) => [...c, { id: newDecisionChildId(), label: t('decisions.newCriterion'), weight: 3 }]);
    setDirty(true);
  }
  function addOption() {
    setOptions((o) => [...o, { id: newDecisionChildId(), label: t('decisions.newOption'), scores: {} }]);
    setDirty(true);
  }
  function setScore(optId: string, critId: string, value: number) {
    setOptions((os) =>
      os.map((o) => (o.id === optId ? { ...o, scores: { ...o.scores, [critId]: value } } : o)),
    );
    setDirty(true);
  }

  const ranked = scoreOptions({ criteria, options });
  const decided = selected?.status === 'decided';
  const chosenLabel =
    options.find((o) => o.id === selected?.chosenOptionId)?.label ?? t('decisions.optionRemoved');

  if (selected) {
    return (
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            <Icon name="arrow-left" /> {t('decisions.title')}
          </button>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="page-head" style={{ marginBottom: 18 }}>
          <div>
            <div className="serif page-title">{selected.title}</div>
            {decided && (
              <div className="page-sub">
                {t('decisions.decidedOn', { date: formatDate(selected.decidedAt), option: chosenLabel })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`pill ${decided ? 'pill-ok' : 'pill-none'}`}>
              {decided ? t('decisions.decided') : t('decisions.draft')}
            </span>
            <button
              className="btn btn-danger"
              onClick={() => setConfirmDelete(true)}
              aria-label={t('decisions.delete')}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>

        <div className="field" style={{ maxWidth: 620 }}>
          <label htmlFor="decision-context">{t('decisions.context')}</label>
          <textarea
            id="decision-context"
            rows={2}
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setDirty(true);
            }}
            placeholder={t('decisions.contextPlaceholder')}
          />
        </div>

        <div className="section-label">
          {t('decisions.criteria')}
          <button className="reveal-btn" onClick={addCriterion}>
            <Icon name="plus" /> {t('decisions.addCriterion')}
          </button>
        </div>
        <div className="list-card" style={{ marginBottom: 20 }}>
          {criteria.length === 0 && (
            <div className="list-row" style={{ color: 'var(--ink-3)' }}>
              {t('decisions.addCriteria')}
            </div>
          )}
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
              <span className="list-row-meta">{t('decisions.weight')}</span>
              <select
                value={c.weight}
                onChange={(e) => {
                  setCriteria((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, weight: Number(e.target.value) } : x)),
                  );
                  setDirty(true);
                }}
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <button
                className="reveal-btn"
                onClick={() => removeCriterion(c.id)}
                aria-label={t('decisions.removeCriterion', { label: c.label })}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>

        <div className="section-label">
          {t('decisions.options')}
          <button className="reveal-btn" onClick={addOption}>
            <Icon name="plus" /> {t('decisions.addCriterion')}
          </button>
        </div>
        <div className="list-card" style={{ marginBottom: 20 }}>
          {options.length === 0 && (
            <div className="list-row" style={{ color: 'var(--ink-3)' }}>
              {t('decisions.addOptions')}
            </div>
          )}
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
                <span
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: 'var(--ink-3)',
                  }}
                >
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
              <button
                className="reveal-btn"
                onClick={() => removeOption(o.id)}
                aria-label={t('decisions.removeOption', { label: o.label })}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>

        {ranked.length > 0 && (
          <>
            <div className="section-label">{t('decisions.score')}</div>
            <div className="list-card" style={{ marginBottom: 20 }}>
              {ranked.map((r, i) => (
                <div className="list-row" key={r.optionId}>
                  {i === 0 && <Icon name="star" style={{ color: 'var(--sage)' }} />}
                  <span style={{ flex: 1, fontWeight: i === 0 ? 500 : 400 }}>{r.label}</span>
                  <span className="list-row-meta">{t('decisions.points', { n: r.total })}</span>
                  {selected.chosenOptionId === r.optionId ? (
                    <span className="pill pill-ok">{t('decisions.chosen')}</span>
                  ) : (
                    !decided && (
                      <button className="reveal-btn" onClick={() => setDeciding(r.optionId)}>
                        {t('decisions.choose')}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {decided && selected.reviewAt && !selected.actualOutcome && (
          <div className="hint" style={{ marginBottom: 20 }}>
            <Icon name="bell" />
            <span>{t('decisions.reviewNote', { date: formatDate(selected.reviewAt) })}</span>
          </div>
        )}

        <div className="section-label">{t('decisions.journal')}</div>
        <div className="list-card" style={{ marginBottom: 20, padding: 14, display: 'grid', gap: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="expected">{t('decisions.expected')}</label>
            <textarea
              id="expected"
              rows={2}
              value={expected}
              onChange={(e) => {
                setExpected(e.target.value);
                setDirty(true);
              }}
              placeholder={t('decisions.expectedPlaceholder')}
            />
            <div className="page-sub" style={{ fontSize: 12, marginTop: 5 }}>
              {t('decisions.expectedHint')}
            </div>
          </div>

          {decided ? (
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="outcome">{t('decisions.outcome')}</label>
              <textarea
                id="outcome"
                rows={2}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder={t('decisions.outcomePlaceholder')}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={() => void saveOutcome()}
                  disabled={outcome.trim() === (selected.actualOutcome ?? '')}
                >
                  {t('decisions.recordOutcome')}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReopen(true)}>
                  {t('decisions.reopen')}
                </button>
              </div>
            </div>
          ) : (
            <div className="page-sub">
              {ranked.length === 0 ? t('decisions.needOptions') : t('decisions.pickOption')}
            </div>
          )}
        </div>

        <button className="btn btn-primary" onClick={save} disabled={!dirty}>
          {dirty ? t('decisions.save') : t('decisions.saved')}
        </button>

        {confirmDelete && (
          <ConfirmDialog
            title={t('decisions.deleteTitle', { title: selected.title })}
            message={t('decisions.deleteMessage')}
            confirmLabel={t('decisions.deleteConfirm')}
            danger
            onConfirm={() => void removeDecision()}
            onCancel={() => setConfirmDelete(false)}
          />
        )}

        {confirmReopen && (
          <ConfirmDialog
            title={t('decisions.reopenTitle')}
            message={t('decisions.reopenMessage')}
            confirmLabel={t('decisions.reopenConfirm')}
            danger
            onConfirm={() => void reopen()}
            onCancel={() => setConfirmReopen(false)}
          />
        )}

        {deciding && (
          <ChoiceDialog
            title={t('decisions.reviewTitle')}
            message={t('decisions.reviewMessage')}
            choices={[
              { value: 6, label: t('decisions.review6'), hint: t('decisions.review6Hint') },
              { value: 3, label: t('decisions.review3'), hint: t('decisions.review3Hint') },
              { value: 12, label: t('decisions.review12'), hint: t('decisions.review12Hint') },
              { value: 0, label: t('decisions.reviewNever') },
            ]}
            onChoose={(months) => void decide(deciding, months)}
            onCancel={() => setDeciding(null)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">{t('decisions.title')}</div>
          <div className="page-sub">{t('decisions.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> {t('decisions.new')}
          </button>
        </div>
      </div>
      {decisions.length === 0 ? (
        <div className="state">{t('decisions.empty')}</div>
      ) : (
        <div className="grid">
          {decisions.map((d) => (
            <button key={d.id} className="card" onClick={() => open(d)}>
              <div className="card-top">
                <span className="icon-chip">
                  <Icon name="scale" />
                </span>
                <span className={`pill ${d.status === 'decided' ? 'pill-ok' : 'pill-none'}`}>
                  {d.status === 'decided' ? t('decisions.decided') : t('decisions.draft')}
                </span>
              </div>
              <div className="card-title">{d.title}</div>
              <div className="card-meta">
                {t('decisions.counts', { options: d.options.length, criteria: d.criteria.length })}
              </div>
            </button>
          ))}
        </div>
      )}
      {creating && (
        <PromptDialog
          title={t('decisions.newTitle')}
          label={t('decisions.newLabel')}
          placeholder={t('decisions.newPlaceholder')}
          confirmLabel={t('decisions.create')}
          onSubmit={createNew}
          onCancel={() => setCreating(false)}
        />
      )}
    </main>
  );
}
