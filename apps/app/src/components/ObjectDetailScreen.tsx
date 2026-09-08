import { useCallback, useEffect, useState } from 'react';
import {
  fieldLabel,
  lifecycleFor,
  lifeObjectStatusLabels,
  objectFields,
  objectTypeLabels,
  sensitivityLabels,
  reminderOffsetChoices,
  reminderRulesFor,
  trashRetentionDays,
  upcomingReminders,
  type LifeObject,
  type LifeObjectStatus,
  type Sensitivity,
} from '@life-os/domain';
import { ledgerStore } from '../lib/store';
import { ConfirmDialog } from './Dialog';
import { Attachments } from './Attachments';
import { SensitivityField, TypeFields } from './ObjectFields';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { formatDate, formatDateTime } from '../lib/format';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';
import { useLocale, useT } from '../lib/i18n';

/** Заголовок раздела полей повторяется в трёх ветках карточки — ключ один. */
const FIELDS = 'object.fields';

/** Значения полей хранятся как есть; для формы приводим их к строкам. */
function toFormData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)]));
}

export function ObjectDetailScreen({
  id,
  onBack,
  theme,
  onToggleTheme,
}: {
  id: string;
  onBack: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [obj, setObj] = useState<LifeObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [status, setStatus] = useState<LifeObjectStatus>('active');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('normal');
  const [data, setData] = useState<Record<string, string>>({});
  const [reminderDays, setReminderDays] = useState<number[] | null>(null);

  const load = useCallback(() => {
    setError(null);
    ledgerStore
      .get(id)
      .then((o) => {
        if (!o) {
          setError(t('object.notFound'));
          return;
        }
        setObj(o);
        setTitle(o.title);
        setValidUntil(o.validUntil ? o.validUntil.slice(0, 10) : '');
        setValidFrom(o.validFrom ? o.validFrom.slice(0, 10) : '');
        setStatus(o.status);
        setSensitivity(o.sensitivity);
        setData(toFormData(o.data));
        setReminderDays(o.reminderDays ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('ledger.loadFailed')));
  }, [id]);

  useEffect(() => load(), [load]);

  async function save() {
    setBusy(true);
    try {
      await ledgerStore.update(id, {
        title: title.trim(),
        status,
        sensitivity,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null,
        // Опустошённое поле убираем из данных, а не сохраняем пустой строкой.
        data: Object.fromEntries(Object.entries(data).filter(([, v]) => v.trim().length > 0)),
        reminderDays,
      });
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('object.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    try {
      await ledgerStore.remove(id);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('object.deleteFailed'));
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="main">
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrow-left" /> {t('object.back')}
        </button>
        <div className="state">{t('object.openFailed')}</div>
      </main>
    );
  }

  if (!obj) {
    return (
      <main className="main">
        <div className="state">{t('app.loading')}</div>
      </main>
    );
  }

  const pill = lifecyclePill(obj);
  const state = lifecycleFor(obj.validUntil);
  const reminders = obj.validUntil
    ? upcomingReminders(obj.validUntil, new Date(), reminderRulesFor(obj.reminderDays))
    : [];
  const dataEntries = Object.entries(obj.data);
  const masked = obj.sensitivity !== 'normal' && !reveal;

  return (
    <main className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="arrow-left" /> {t('ledger.title')}
        </button>
        <button className="btn" onClick={onToggleTheme} aria-label={t('theme.toggle')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      <div className="detail-head">
        <span className="icon-chip icon-chip-lg">
          <Icon name={typeIcons[obj.type]} />
        </span>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label={t('object.title')}
            />
          ) : (
            <div className="serif" style={{ fontSize: 24 }}>
              {obj.title}
            </div>
          )}
          <div className="page-sub">{objectTypeLabels[obj.type].ru}</div>
        </div>
        {!editing && <span className={`pill ${pill.cls}`}>{pill.label}</span>}
      </div>

      <div className="actions-row">
        {editing ? (
          <>
            <button className="btn btn-primary" onClick={save} disabled={busy || title.trim().length === 0}>
              {busy ? t('object.saving') : t('object.save')}
            </button>
            <button
              className="btn"
              onClick={() => {
                setEditing(false);
                load();
              }}
              disabled={busy}
            >
              {t('dialog.cancel')}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setEditing(true)}>
              <Icon name="edit" /> {t('object.edit')}
            </button>
            <button
              className="btn"
              onClick={() => {
                // На бумаге маскировка бессмысленна — раскрываем поля до печати.
                setReveal(true);
                setTimeout(() => window.print(), 50);
              }}
            >
              <Icon name="file-text" /> {t('object.print')}
            </button>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Icon name="trash" /> {t('object.delete')}
            </button>
          </>
        )}
      </div>

      <div className="kv-grid">
        <div className="kv">
          <span className="kv-label">{t('object.validUntilLabel')}</span>
          {editing ? (
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          ) : (
            <span className="kv-value">{formatDate(obj.validUntil)}</span>
          )}
        </div>
        <div className="kv">
          <span className="kv-label">{t('object.status')}</span>
          {editing ? (
            <select value={status} onChange={(e) => setStatus(e.target.value as LifeObjectStatus)}>
              <option value="active">{lifeObjectStatusLabels.active[locale]}</option>
              <option value="archived">{lifeObjectStatusLabels.archived[locale]}</option>
            </select>
          ) : (
            <span className="kv-value">{lifeObjectStatusLabels[obj.status][locale]}</span>
          )}
        </div>
        <div className="kv">
          <span className="kv-label">{t('object.validFrom')}</span>
          {editing ? (
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          ) : (
            <span className="kv-value">{formatDate(obj.validFrom)}</span>
          )}
        </div>
        {!editing && (
          <div className="kv">
            <span className="kv-label">{t('object.sensitivity')}</span>
            <span className="kv-value">{sensitivityLabels[obj.sensitivity][locale]}</span>
          </div>
        )}
      </div>

      {editing ? (
        <>
          <div className="section-label">{t(FIELDS)}</div>
          <div style={{ maxWidth: 420, marginBottom: 22 }}>
            <TypeFields
              type={obj.type}
              data={data}
              onChange={(key, value) => setData((d) => ({ ...d, [key]: value }))}
            />
            <SensitivityField value={sensitivity} onChange={setSensitivity} />
          </div>
        </>
      ) : (
        dataEntries.length > 0 && (
          <>
            <div className="section-label">
              {t(FIELDS)}
              {obj.sensitivity !== 'normal' && (
                <button className="reveal-btn" onClick={() => setReveal((r) => !r)}>
                  <Icon name={masked ? 'lock' : 'lock-open'} />
                  {masked ? t('object.reveal') : t('object.hide')}
                </button>
              )}
            </div>
            <div className="kv-grid">
              {dataEntries.map(([k, v]) => (
                <div className="kv" key={k}>
                  <span className="kv-label">{fieldLabel(obj.type, k, locale)}</span>
                  <span className="kv-value">{masked ? '•• •••• ••' : String(v)}</span>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {!editing && dataEntries.length === 0 && objectFields[obj.type].length > 0 && (
        <>
          <div className="section-label">{t(FIELDS)}</div>
          <div className="note" style={{ marginBottom: 22 }}>
            {t('object.fieldsHint', { field: objectFields[obj.type][0]?.label[locale] ?? '' })}
          </div>
        </>
      )}

      <Attachments objectId={id} />

      <div className="section-label">{t('object.reminders')}</div>
      {editing && (
        <div className="list-card" style={{ marginBottom: 14, padding: 14 }}>
          <div className="page-sub" style={{ marginBottom: 10 }}>
            {t('object.remindersHint')}
          </div>
          <div className="filters" style={{ marginBottom: 0 }}>
            {reminderOffsetChoices.map((days) => {
              const active = reminderDays?.includes(days) ?? false;
              return (
                <button
                  key={days}
                  className={`chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    setReminderDays((current) => {
                      const next = new Set(current ?? []);
                      if (next.has(days)) next.delete(days);
                      else next.add(days);
                      // Пустой набор — это «как у всех», а не «молчать вовсе».
                      return next.size === 0 ? null : [...next].sort((a, b) => b - a);
                    })
                  }
                >
                  {t('object.days', { n: days })}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {reminders.length === 0 ? (
        <div className="note">{obj.validUntil ? t('object.noReminders') : t('object.needDeadline')}</div>
      ) : (
        <div className="list-card">
          {reminders.map((r) => (
            <div className="list-row" key={r.offsetDays}>
              <Icon name="bell" style={{ color: 'var(--sage)' }} />
              <span>{t('object.reminderBefore', { n: r.offsetDays })}</span>
              <span className="list-row-meta">{formatDate(r.fireAt)}</span>
            </div>
          ))}
        </div>
      )}

      {(state === 'due_soon' || state === 'overdue') && (
        <div className="hint">
          <Icon name="info-circle" />
          <span>{state === 'overdue' ? t('object.overdueHint') : t('object.dueSoonHint')}</span>
        </div>
      )}

      <div className="section-label">{t('object.history')}</div>
      <div className="timeline">
        <div className="timeline-row">
          <span className="timeline-dot" />
          <div>
            <div>{t('object.lastChange', { version: obj.version })}</div>
            <div className="page-sub">{formatDateTime(obj.updatedAt)}</div>
          </div>
        </div>
        <div className="timeline-row">
          <span className="timeline-dot timeline-dot-muted" />
          <div>
            <div>{t('object.created')}</div>
            <div className="page-sub">{formatDateTime(obj.createdAt)}</div>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={t('object.deleteTitle')}
          message={t('object.deleteMessage', { days: trashRetentionDays })}
          confirmLabel={t('object.deleteConfirm')}
          danger
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
