import { useEffect, useState } from 'react';
import {
  daysUntil,
  lifecycleFor,
  objectTypeLabels,
  type Decision,
  type HouseholdTask,
  type LifeObject,
} from '@life-os/domain';
import { decisionsStore, householdStore, ledgerStore } from '../lib/store';
import { formatDate, formatWeekdayDate } from '../lib/format';
import { backupIsStale, lastBackupAt } from '../lib/backup';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import { useLocale, useT, type TFunction } from '../lib/i18n';

const order = { overdue: 0, due_soon: 1, ok: 2, none: 3 } as const;

/**
 * Подпись под приветствием: у экрана четыре состояния, и в русском счётчик тянет за собой не
 * только существительное, но и глагол — поэтому каждое состояние отдельным сообщением.
 */
function summary(t: TFunction, attention: LifeObject[] | null, empty: boolean, count: number): string {
  if (attention === null) return t('app.loading');
  if (empty) return t('today.emptyHint');
  if (count === 0) return t('today.allCalm');
  return t('today.needsAttention', { n: count });
}

export function TodayScreen({
  theme,
  onToggleTheme,
  onOpenObject,
  onOpenSettings,
  onOpenLedger,
  onOpenDecisions,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenObject: (id: string) => void;
  onOpenSettings: () => void;
  onOpenLedger: () => void;
  onOpenDecisions: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [attention, setAttention] = useState<LifeObject[] | null>(null);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
  const [reviews, setReviews] = useState<Decision[]>([]);
  const [backupStale, setBackupStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const [totalObjects, setTotalObjects] = useState(0);

  useEffect(() => {
    // Отказ хранилища не должен оставлять экран в вечной «Загрузке» — показываем это честно.
    const fail = () => setFailed(true);

    void ledgerStore
      .list()
      .then((objects) => {
        setTotalObjects(objects.length);
        const flagged = objects
          .filter((o) => {
            // Архивное не требует внимания: срок у сданного паспорта уже неважен.
            if (o.status === 'archived') return false;
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
      })
      .catch(fail);

    // Решения, к которым пора вернуться: срок наступил, а исход ещё не записан.
    void decisionsStore
      .list()
      .then((all) =>
        setReviews(
          all.filter(
            (d) =>
              d.status === 'decided' &&
              d.reviewAt !== null &&
              !d.actualOutcome &&
              (daysUntil(d.reviewAt) ?? 1) <= 0,
          ),
        ),
      )
      .catch(() => {
        /* решения не настолько срочны, чтобы ронять из-за них главный экран */
      });

    // Данные лежат только здесь: если копии давно не было, об этом стоит сказать спокойно.
    void lastBackupAt()
      .then((at) => setBackupStale(backupIsStale(at)))
      .catch(() => {
        /* напоминание о копии не настолько важно, чтобы ломать из-за него экран */
      });

    void householdStore
      .current()
      .then(async (house) => {
        if (!house) return;
        const all = await householdStore.tasks(house.id);
        setTasks(
          all
            .filter((x) => x.status === 'open')
            // Со сроком — вперёд и по возрастанию срока: просроченное должно попадаться на глаза.
            .sort((a, b) => (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿')),
        );
      })
      .catch(fail);
  }, []);

  // Просроченная задача по дому — такое же «дело», как истекающий документ: с появлением сроков
  // у задач заголовок обязан их учитывать, иначе он врёт.
  const urgentTasks = tasks.filter((task) => (daysUntil(task.dueAt) ?? 1) <= 0).length;
  // Ничего не внесено — «всё под контролем» здесь было бы неправдой и ничего не подсказывало бы.
  const empty = attention !== null && totalObjects === 0 && tasks.length === 0 && reviews.length === 0;
  const flaggedObjects = attention?.length ?? 0;
  const count = flaggedObjects + urgentTasks + reviews.length;

  if (failed) {
    return (
      <main className="main">
        <div className="serif page-title" style={{ marginBottom: 8 }}>
          {t('today.readFailed')}
        </div>
        <div className="page-sub" style={{ maxWidth: 520, marginBottom: 18 }}>
          {t('today.readFailedHint')}
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('error.restart')}
        </button>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="page-sub" style={{ marginBottom: 2 }}>
            {formatWeekdayDate(new Date())}
          </div>
          <div className="serif page-title">{t('today.greeting')}</div>
          <div className="page-sub" style={{ marginTop: 4 }}>
            {summary(t, attention, empty, count)}
          </div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label={t('theme.toggle')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      {backupStale && (
        <div className="hint" style={{ marginBottom: 20 }} role="status">
          <Icon name="download" />
          <span style={{ flex: 1 }}>{t('today.backupNote')}</span>
          <button className="btn" onClick={onOpenSettings}>
            {t('today.backupAction')}
          </button>
        </div>
      )}

      {flaggedObjects > 0 && (
        <>
          <div className="section-label">{t('today.attentionSection')}</div>
          <div className="list-card" style={{ marginBottom: 22 }}>
            {attention!.map((o) => {
              const pill = lifecyclePill(o);
              return (
                <button
                  key={o.id}
                  className="list-row"
                  onClick={() => onOpenObject(o.id)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    borderBottom: '0.5px solid var(--line)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span className="icon-chip" style={{ width: 32, height: 32, fontSize: 16 }}>
                    <Icon name={typeIcons[o.type]} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{o.title}</span>
                    <span className="page-sub"> · {objectTypeLabels[o.type][locale]}</span>
                  </span>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {reviews.length > 0 && (
        <>
          <div className="section-label">{t('today.decisionsSection')}</div>
          <div className="list-card" style={{ marginBottom: 22 }}>
            {reviews.map((d) => (
              <button
                key={d.id}
                className="list-row"
                onClick={onOpenDecisions}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: '0.5px solid var(--line)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span className="icon-chip" style={{ width: 32, height: 32, fontSize: 16 }}>
                  <Icon name="scale" />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{d.title}</span>
                  <span className="page-sub">{t('today.decidedOn', { date: formatDate(d.decidedAt) })}</span>
                </span>
                <span className="pill pill-warn">{t('today.recordOutcome')}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-label">{t('today.tasksSection')}</div>
          <div className="list-card">
            {tasks.map((task) => (
              <div className="list-row" key={task.id}>
                <span className="check" aria-hidden="true" />
                <span style={{ flex: 1 }}>{task.title}</span>
                {task.dueAt && (
                  <span
                    className="list-row-meta"
                    style={{
                      color: lifecycleFor(task.dueAt) === 'overdue' ? 'var(--brick-ink)' : 'var(--ink-3)',
                    }}
                  >
                    {formatDate(task.dueAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {empty && (
        <div className="state" style={{ textAlign: 'left', maxWidth: 640 }}>
          <div style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
            {t('today.onboardingTitle')}
          </div>
          <div style={{ marginBottom: 14 }}>{t('today.onboardingBody')}</div>
          <ol style={{ margin: '0 0 16px', paddingLeft: 20, lineHeight: 1.9 }}>
            <li>{t('today.onboarding1')}</li>
            <li>{t('today.onboarding2')}</li>
            <li>{t('today.onboarding3')}</li>
            <li>{t('today.onboarding4')}</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onOpenLedger}>
              {t('ledger.addFirst')}
            </button>
            <button className="btn" onClick={onOpenSettings}>
              {t('today.openSettings')}
            </button>
          </div>
        </div>
      )}

      {attention !== null && !empty && count === 0 && tasks.length === 0 && reviews.length === 0 && (
        <div className="state">{t('today.calmDay')}</div>
      )}
    </main>
  );
}
