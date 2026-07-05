import { useCallback, useEffect, useState } from 'react';
import {
  roleLabels,
  type AuditEntry,
  type Household,
  type HouseholdTask,
  type Membership,
  type Role,
} from '@life-os/domain';
import { householdApi } from '../lib/household-api';
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

  async function addMember(role: Role, name: string) {
    if (!household) return;
    await householdApi.addMember(household.id, { userId: crypto.randomUUID(), displayName: name, role });
    loadDetail(household.id);
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
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="reveal-btn" onClick={() => addMember('adult', 'Мария')}>
                <i className="ti ti-user-plus" aria-hidden="true" /> взрослый
              </button>
              <button className="reveal-btn" onClick={() => addMember('child', 'Даша')}>
                <i className="ti ti-user-plus" aria-hidden="true" /> ребёнок
              </button>
            </span>
          </div>
          <div className="grid" style={{ marginBottom: 22 }}>
            {members.map((m) => (
              <div className="card" key={m.id} style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span className={`avatar ${roleTint[m.role]}`}>{m.displayName.slice(0, 1)}</span>
                  <div>
                    <div className="card-title">{m.displayName}</div>
                    <div className="card-meta">{roleLabels[m.role].ru}</div>
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
