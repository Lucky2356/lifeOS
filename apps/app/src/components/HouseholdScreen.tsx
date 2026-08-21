import { useCallback, useEffect, useState } from 'react';
import {
  lifecycleFor,
  relationshipLabels,
  relationships,
  type Household,
  type HouseholdTask,
  type Membership,
  type Relationship,
  type Role,
} from '@life-os/domain';
import { householdStore } from '../lib/store';
import { counted, formatDate } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';

const roleTint: Record<Role, string> = {
  owner: 'tint-sage',
  adult: 'tint-clay',
  child: 'tint-amber',
  guest: 'tint-muted',
};

/**
 * «Дом» в локальном виде: люди, которых касаются домашние дела, и общий список задач.
 * Совместного доступа нет — данные не покидают устройство, делиться ими не с кем.
 */
export function HouseholdScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [newTask, setNewTask] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [adding, setAdding] = useState(false);
  const [mName, setMName] = useState('');
  const [mRel, setMRel] = useState<Relationship>('partner');
  const [pendingRemove, setPendingRemove] = useState<Membership | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    const [m, t] = await Promise.all([householdStore.members(id), householdStore.tasks(id)]);
    setMembers(m);
    setTasks(t);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    void householdStore
      .current()
      .then(async (h) => {
        setHousehold(h);
        if (h) await loadDetail(h.id);
      })
      .finally(() => setLoading(false));
  }, [loadDetail]);

  useEffect(() => load(), [load]);

  async function createHouse() {
    const h = await householdStore.create('Наш дом', myName.trim() || 'Я');
    setHousehold(h);
    await loadDetail(h.id);
  }

  async function addTask() {
    if (!household || newTask.trim().length === 0) return;
    await householdStore.createTask(household.id, {
      title: newTask.trim(),
      assigneeMembershipId: assignee || null,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setNewTask('');
    setDueAt('');
    await loadDetail(household.id);
  }

  async function toggle(taskId: string) {
    if (!household) return;
    await householdStore.toggleTask(taskId);
    await loadDetail(household.id);
  }

  async function submitMember() {
    if (!household || mName.trim().length === 0) return;
    await householdStore.addMember(household.id, { displayName: mName.trim(), relationship: mRel });
    setMName('');
    setMRel('partner');
    setAdding(false);
    await loadDetail(household.id);
  }

  async function confirmRemove() {
    if (!household || !pendingRemove) return;
    await householdStore.removeMember(pendingRemove.id);
    setPendingRemove(null);
    await loadDetail(household.id);
  }

  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.displayName ?? null;
  const openCount = tasks.filter((t) => t.status === 'open').length;

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">Дом</div>
          <div className="page-sub">
            {loading
              ? 'Загрузка…'
              : household
                ? `${counted(members.length, 'человек', 'человека', 'человек')} · ${counted(openCount, 'открытая задача', 'открытые задачи', 'открытых задач')}`
                : 'Домашние дела и люди'}
          </div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} aria-hidden="true" />
        </button>
      </div>

      {!loading && !household && (
        <div className="state">
          Соберите здесь домашние дела и людей, которых они касаются.
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <input
              className="inline-input"
              style={{ maxWidth: 220 }}
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createHouse()}
              placeholder="Как вас зовут"
              aria-label="Как вас зовут"
            />
            <button className="btn btn-primary" onClick={() => void createHouse()}>
              Создать дом
            </button>
          </div>
        </div>
      )}

      {household && (
        <>
          <div className="section-label">
            Люди
            {!adding && (
              <button className="reveal-btn" onClick={() => setAdding(true)}>
                <i className="ti ti-user-plus" aria-hidden="true" /> добавить
              </button>
            )}
          </div>

          {adding && (
            <div className="list-card" style={{ marginBottom: 14, padding: 14 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label className="page-sub" htmlFor="member-name">
                  Имя
                </label>
                <input
                  id="member-name"
                  className="inline-input"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitMember()}
                  placeholder="Как зовут"
                  autoFocus
                />
                <label className="page-sub" htmlFor="member-rel">
                  Кто это для вас
                </label>
                <select
                  id="member-rel"
                  value={mRel}
                  onChange={(e) => setMRel(e.target.value as Relationship)}
                >
                  {relationships
                    .filter((r) => r !== 'self')
                    .map((r) => (
                      <option key={r} value={r}>
                        {relationshipLabels[r].ru}
                      </option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void submitMember()}
                    disabled={mName.trim().length === 0}
                  >
                    Добавить
                  </button>
                  <button className="btn btn-ghost" onClick={() => setAdding(false)}>
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
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{m.displayName}</div>
                    {/* Роль без сервера ничего не разрешает и не запрещает — показываем только,
                        кто это человек для владельца. */}
                    <div className="card-meta">{relationshipLabels[m.relationship].ru}</div>
                  </div>
                  {m.relationship !== 'self' && (
                    <button
                      className="reveal-btn"
                      onClick={() => setPendingRemove(m)}
                      aria-label={`Убрать ${m.displayName}`}
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  )}
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
                  onClick={() => void toggle(t.id)}
                  aria-label={t.status === 'done' ? 'Снять отметку' : 'Отметить выполненной'}
                >
                  {t.status === 'done' && <i className="ti ti-check" aria-hidden="true" />}
                </button>
                <span
                  style={{
                    flex: 1,
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    color: t.status === 'done' ? 'var(--ink-3)' : 'var(--ink)',
                  }}
                >
                  {t.title}
                </span>
                {t.dueAt && t.status === 'open' && (
                  <span
                    className="list-row-meta"
                    style={{
                      color: lifecycleFor(t.dueAt) === 'overdue' ? 'var(--brick-ink)' : 'var(--ink-3)',
                    }}
                  >
                    {formatDate(t.dueAt)}
                  </span>
                )}
                {nameOf(t.assigneeMembershipId) && (
                  <span className="list-row-meta">{nameOf(t.assigneeMembershipId)}</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
            <input
              className="inline-input"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addTask()}
              placeholder="Новая общая задача"
            />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              aria-label="Срок задачи"
            />
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Исполнитель">
              <option value="">Без исполнителя</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => void addTask()}
              disabled={newTask.trim().length === 0}
            >
              Добавить
            </button>
          </div>
        </>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title={`Убрать ${pendingRemove.displayName} из дома?`}
          confirmLabel="Убрать"
          danger
          onConfirm={() => void confirmRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </main>
  );
}
