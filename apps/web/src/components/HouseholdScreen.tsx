import { useCallback, useEffect, useState } from 'react';
import {
  defaultRoleForRelationship,
  relationshipLabels,
  relationships,
  roleLabels,
  type AuditEntry,
  type Household,
  type HouseholdTask,
  type Membership,
  type Relationship,
  type Role,
} from '@life-os/domain';
import { offlineHousehold as householdApi } from '../lib/offline-household';
import { formatDateTime } from '../lib/format';
import type { Theme } from '../lib/theme';

const auditLabels: Record<string, string> = {
  add_member: 'добавил участника',
  create_task: 'создал задачу',
  toggle_task: 'отметил задачу',
};

const roleTint: Record<Role, string> = {
  owner: 'tint-sage',
  adult: 'tint-clay',
  child: 'tint-amber',
  guest: 'tint-muted',
};

export function HouseholdScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  // Панель добавления участника.
  const [addMode, setAddMode] = useState<'closed' | 'invite' | 'manual'>('closed');
  const [mEmail, setMEmail] = useState('');
  const [mName, setMName] = useState('');
  const [mRel, setMRel] = useState<Relationship>('partner');
  const [mError, setMError] = useState<string | null>(null);
  const [mBusy, setMBusy] = useState(false);

  const loadDetail = useCallback((id: string) => {
    void Promise.all([householdApi.members(id), householdApi.tasks(id), householdApi.audit(id)]).then(
      ([m, t, a]) => {
        setMembers(m);
        setTasks(t);
        setAudit(a);
      },
    );
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    householdApi
      .listMine()
      .then((hs) => {
        const first = hs[0] ?? null;
        setHousehold(first);
        if (first) loadDetail(first.id);
      })
      .finally(() => setLoading(false));
  }, [loadDetail]);

  useEffect(() => load(), [load]);

  async function createHouse() {
    const h = await householdApi.create('Наш дом', 'Алекс');
    setHousehold(h);
    loadDetail(h.id);
  }

  async function addTask() {
    if (!household || newTask.trim().length === 0) return;
    await householdApi.createTask(household.id, { title: newTask.trim() });
    setNewTask('');
    loadDetail(household.id);
  }

  async function toggle(taskId: string) {
    if (!household) return;
    await householdApi.toggleTask(household.id, taskId);
    loadDetail(household.id);
  }

  function resetAdd() {
    setAddMode('closed');
    setMEmail('');
    setMName('');
    setMRel('partner');
    setMError(null);
  }

  async function submitMember() {
    if (!household) return;
    setMBusy(true);
    setMError(null);
    try {
      if (addMode === 'invite') {
        if (!mEmail.trim()) throw new Error('Введите e-mail');
        await householdApi.invite(household.id, { email: mEmail.trim(), relationship: mRel });
      } else {
        if (!mName.trim()) throw new Error('Введите имя');
        await householdApi.addMember(household.id, {
          userId: crypto.randomUUID(),
          displayName: mName.trim(),
          relationship: mRel,
          role: defaultRoleForRelationship(mRel),
        });
      }
      resetAdd();
      loadDetail(household.id);
    } catch (e) {
      setMError(
        e instanceof Error && e.message.includes('404')
          ? 'Пользователь с такой почтой ещё не зарегистрирован'
          : e instanceof Error && e.message.includes('409')
            ? 'Этот человек уже в вашем доме'
            : 'Не удалось добавить участника',
      );
    } finally {
      setMBusy(false);
    }
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Дом</div>
          <div className="page-sub">
            {loading ? 'Загрузка…' : household ? `${members.length} участников` : 'Общий контур семьи'}
          </div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      {!loading && !household && (
        <div className="state">
          Создайте общий контур для семьи — с ролями, задачами и журналом доступа.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={createHouse}>
              Создать дом
            </button>
          </div>
        </div>
      )}

      {household && (
        <>
          <div className="section-label">
            Участники
            {addMode === 'closed' && (
              <button className="reveal-btn" onClick={() => setAddMode('invite')}>
                <i className="ti ti-user-plus" aria-hidden="true" /> добавить
              </button>
            )}
          </div>

          {addMode !== 'closed' && (
            <div className="list-card" style={{ marginBottom: 14, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  className={`btn ${addMode === 'invite' ? 'btn-primary' : ''}`}
                  onClick={() => setAddMode('invite')}
                >
                  Пригласить по почте
                </button>
                <button
                  className={`btn ${addMode === 'manual' ? 'btn-primary' : ''}`}
                  onClick={() => setAddMode('manual')}
                >
                  Без аккаунта
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {addMode === 'invite' ? (
                  <>
                    <label className="page-sub">
                      E-mail человека (он должен быть зарегистрирован в Life OS)
                    </label>
                    <input
                      className="inline-input"
                      type="email"
                      value={mEmail}
                      onChange={(e) => setMEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <label className="page-sub">Имя (участник без своего аккаунта, напр. ребёнок)</label>
                    <input
                      className="inline-input"
                      value={mName}
                      onChange={(e) => setMName(e.target.value)}
                      placeholder="Как зовут"
                      autoFocus
                    />
                  </>
                )}

                <label className="page-sub">Кто это для вас</label>
                <select value={mRel} onChange={(e) => setMRel(e.target.value as Relationship)}>
                  {relationships
                    .filter((r) => r !== 'self')
                    .map((r) => (
                      <option key={r} value={r}>
                        {relationshipLabels[r].ru}
                      </option>
                    ))}
                </select>

                {mError && <div style={{ color: 'var(--brick-ink)', fontSize: 13 }}>{mError}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={submitMember} disabled={mBusy}>
                    {mBusy ? 'Добавляем…' : addMode === 'invite' ? 'Пригласить' : 'Добавить'}
                  </button>
                  <button className="btn btn-ghost" onClick={resetAdd}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid" style={{ marginBottom: 22 }}>
            {members.map((m) => (
              <div className="card" key={m.id} style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span className={`avatar ${roleTint[m.role]}`}>{m.displayName.slice(0, 1)}</span>
                  <div>
                    <div className="card-title">{m.displayName}</div>
                    <div className="card-meta">
                      {relationshipLabels[m.relationship ?? 'other'].ru} · {roleLabels[m.role].ru}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-label">Общие задачи</div>
          <div className="list-card" style={{ marginBottom: 14 }}>
            {tasks.length === 0 && (
              <div className="list-row" style={{ color: 'var(--ink-3)' }}>
                Пока нет задач
              </div>
            )}
            {tasks.map((t) => (
              <div className="list-row" key={t.id}>
                <button
                  className={`check ${t.status === 'done' ? 'check-done' : ''}`}
                  onClick={() => toggle(t.id)}
                  aria-label={t.status === 'done' ? 'Снять отметку' : 'Отметить выполненной'}
                >
                  {t.status === 'done' && <i className="ti ti-check" aria-hidden="true" />}
                </button>
                <span
                  style={{
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    color: t.status === 'done' ? 'var(--ink-3)' : 'var(--ink)',
                  }}
                >
                  {t.title}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            <input
              className="inline-input"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
              placeholder="Новая общая задача"
            />
            <button className="btn btn-primary" onClick={addTask} disabled={newTask.trim().length === 0}>
              Добавить
            </button>
          </div>

          <div className="section-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-eye" aria-hidden="true" /> Журнал доступа
            </span>
          </div>
          <div className="list-card">
            {audit.length === 0 && (
              <div className="list-row" style={{ color: 'var(--ink-3)' }}>
                Событий пока нет
              </div>
            )}
            {audit.slice(0, 8).map((e) => (
              <div className="list-row" key={e.id}>
                <span>
                  {members.find((m) => m.userId === e.actorUserId)?.displayName ?? 'Участник'}{' '}
                  {auditLabels[e.action] ?? e.action}
                </span>
                <span className="list-row-meta">{formatDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
