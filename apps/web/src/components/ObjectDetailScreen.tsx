import { useCallback, useEffect, useState } from 'react';
import {
  lifecycleFor,
  objectTypeLabels,
  upcomingReminders,
  type LifeObject,
  type LifeObjectStatus,
} from '@life-os/domain';
import { offlineLedger } from '../lib/offline-ledger';
import { ConfirmDialog } from './Dialog';
import { aiApi } from '../lib/ai-api';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import { formatDate, formatDateTime } from '../lib/format';
import type { Theme } from '../lib/theme';

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; text: string; provider: string }
  | { status: 'disabled' }
  | { status: 'error' };

const sensitivityLabels = { normal: 'Обычная', sensitive: 'Чувствительная', high: 'Повышенная' };
const statusLabels: Record<LifeObjectStatus, string> = { active: 'Активен', archived: 'В архиве' };

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
  const [obj, setObj] = useState<LifeObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState<LifeObjectStatus>('active');

  const load = useCallback(() => {
    setError(null);
    offlineLedger
      .get(id)
      .then((o) => {
        if (!o) {
          setError('Объект не найден');
          return;
        }
        setObj(o);
        setTitle(o.title);
        setValidUntil(o.validUntil ? o.validUntil.slice(0, 10) : '');
        setStatus(o.status);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [id]);

  useEffect(() => load(), [load]);

  async function save() {
    setBusy(true);
    try {
      await offlineLedger.update(id, {
        title: title.trim(),
        status,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      });
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setBusy(true);
    try {
      await offlineLedger.remove(id);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
      setBusy(false);
    }
  }

  async function askAi() {
    if (!obj) return;
    setAi({ status: 'loading' });
    const ctx = `Объект «${obj.title}» (${obj.type}), срок: ${obj.validUntil ?? 'нет'}.`;
    const res = await aiApi.suggest('ledger', 'next_step', ctx);
    if (!res.ok) {
      setAi({ status: res.reason === 'disabled' ? 'disabled' : 'error' });
    } else {
      setAi({ status: 'done', text: res.suggestion.text, provider: res.suggestion.provider });
    }
  }

  if (error) {
    return (
      <main className="main">
        <button className="btn btn-ghost" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Назад
        </button>
        <div className="state">Не удалось открыть объект.</div>
      </main>
    );
  }

  if (!obj) {
    return (
      <main className="main">
        <div className="state">Загрузка…</div>
      </main>
    );
  }

  const pill = lifecyclePill(obj);
  const state = lifecycleFor(obj.validUntil);
  const reminders = obj.validUntil ? upcomingReminders(obj.validUntil) : [];
  const dataEntries = Object.entries(obj.data);
  const masked = obj.sensitivity !== 'normal' && !reveal;

  return (
    <main className="main">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Реестр
        </button>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      <div className="detail-head">
        <span className="icon-chip icon-chip-lg">
          <i className={`ti ${typeIcons[obj.type]}`} aria-hidden="true" />
        </span>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Название"
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
              {busy ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button
              className="btn"
              onClick={() => {
                setEditing(false);
                load();
              }}
              disabled={busy}
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setEditing(true)}>
              <i className="ti ti-edit" aria-hidden="true" /> Изменить
            </button>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <i className="ti ti-trash" aria-hidden="true" /> Удалить
            </button>
          </>
        )}
      </div>

      <div className="kv-grid">
        <div className="kv">
          <span className="kv-label">Действует до / дедлайн</span>
          {editing ? (
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          ) : (
            <span className="kv-value">{formatDate(obj.validUntil)}</span>
          )}
        </div>
        <div className="kv">
          <span className="kv-label">Статус</span>
          {editing ? (
            <select value={status} onChange={(e) => setStatus(e.target.value as LifeObjectStatus)}>
              <option value="active">Активен</option>
              <option value="archived">В архиве</option>
            </select>
          ) : (
            <span className="kv-value">{statusLabels[obj.status]}</span>
          )}
        </div>
        <div className="kv">
          <span className="kv-label">Чувствительность</span>
          <span className="kv-value">{sensitivityLabels[obj.sensitivity]}</span>
        </div>
        <div className="kv">
          <span className="kv-label">Действует с</span>
          <span className="kv-value">{formatDate(obj.validFrom)}</span>
        </div>
      </div>

      {dataEntries.length > 0 && (
        <>
          <div className="section-label">
            Поля
            {obj.sensitivity !== 'normal' && (
              <button className="reveal-btn" onClick={() => setReveal((r) => !r)}>
                <i className={`ti ${masked ? 'ti-lock' : 'ti-lock-open'}`} aria-hidden="true" />
                {masked ? 'Показать' : 'Скрыть'}
              </button>
            )}
          </div>
          <div className="kv-grid">
            {dataEntries.map(([k, v]) => (
              <div className="kv" key={k}>
                <span className="kv-label">{k}</span>
                <span className="kv-value">{masked ? '•• •••• ••' : String(v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Напоминания</div>
      {reminders.length === 0 ? (
        <div className="note">
          {obj.validUntil ? 'Ближайших напоминаний нет.' : 'Добавьте дедлайн, чтобы получать напоминания.'}
        </div>
      ) : (
        <div className="list-card">
          {reminders.map((r) => (
            <div className="list-row" key={r.offsetDays}>
              <i className="ti ti-bell" aria-hidden="true" style={{ color: 'var(--sage)' }} />
              <span>За {r.offsetDays} дн. до срока</span>
              <span className="list-row-meta">{formatDate(r.fireAt)}</span>
            </div>
          ))}
        </div>
      )}

      {(state === 'due_soon' || state === 'overdue') && (
        <div className="hint">
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>
            {state === 'overdue'
              ? 'Срок уже прошёл — стоит заняться в ближайшее время.'
              : 'Срок приближается — можно спокойно подготовиться заранее.'}
          </span>
        </div>
      )}

      <div style={{ margin: '22px 0' }}>
        {ai.status === 'idle' && (
          <button className="btn" onClick={askAi}>
            <i className="ti ti-sparkles" aria-hidden="true" /> Спросить ИИ о следующем шаге
          </button>
        )}
        {ai.status === 'loading' && <div className="note">ИИ думает…</div>}
        {ai.status === 'disabled' && (
          <div className="hint">
            <i className="ti ti-info-circle" aria-hidden="true" />
            <span>
              ИИ выключен — включите его в настройках, если нужно. Напоминания и все действия работают и без
              него.
            </span>
          </div>
        )}
        {ai.status === 'error' && <div className="note">Не удалось получить ответ ИИ.</div>}
        {ai.status === 'done' && (
          <div className="ai-block">
            <div className="ai-block-head">
              <span className="ai-badge">
                <i className="ti ti-sparkles" aria-hidden="true" />
              </span>
              <span className="ai-label">Предложил ИИ</span>
              <span className="ai-hint">можно сделать вручную</span>
              <button className="ai-dismiss" onClick={() => setAi({ status: 'idle' })}>
                Скрыть
              </button>
            </div>
            <div className="ai-text">{ai.text}</div>
          </div>
        )}
      </div>

      <div className="section-label">История</div>
      <div className="timeline">
        <div className="timeline-row">
          <span className="timeline-dot" />
          <div>
            <div>Последнее изменение · версия {obj.version}</div>
            <div className="page-sub">{formatDateTime(obj.updatedAt)}</div>
          </div>
        </div>
        <div className="timeline-row">
          <span className="timeline-dot timeline-dot-muted" />
          <div>
            <div>Объект создан</div>
            <div className="page-sub">{formatDateTime(obj.createdAt)}</div>
          </div>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title="Удалить объект?"
          message="Его можно будет восстановить позднее."
          confirmLabel="Удалить"
          danger
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
