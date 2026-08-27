import { useCallback, useEffect, useState } from 'react';
import {
  lifecycleFor,
  relationshipLabels,
  relationships,
  repeatLabels,
  repeats,
  type Household,
  type HouseholdTask,
  type Membership,
  type Relationship,
  type Repeat,
  type Role,
} from '@life-os/domain';
import { householdStore } from '../lib/store';
import { counted, formatDate } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';
import { Icon } from './Icon';

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
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [adding, setAdding] = useState(false);
  const [mName, setMName] = useState('');
  const [mRel, setMRel] = useState<Relationship>('partner');
  const [pendingRemove, setPendingRemove] = useState<Membership | null>(null);
  const [pendingTaskRemove, setPendingTaskRemove] = useState<HouseholdTask | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; dueAt: string; assignee: string; repeat: Repeat }>({
    title: '',
    dueAt: '',
    assignee: '',
    repeat: 'none',
  });

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
      repeat,
    });
    setNewTask('');
    setDueAt('');
    setRepeat('none');
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

  function startEdit(task: HouseholdTask) {
    setEditingTask(task.id);
    setDraft({
      title: task.title,
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
      assignee: task.assigneeMembershipId ?? '',
      repeat: task.repeat,
    });
  }

  async function saveTask() {
    if (!household || !editingTask || draft.title.trim().length === 0) return;
    await householdStore.updateTask(editingTask, {
      title: draft.title.trim(),
      dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
      assigneeMembershipId: draft.assignee || null,
      repeat: draft.repeat,
    });
    setEditingTask(null);
    await loadDetail(household.id);
  }

  async function confirmTaskRemove() {
    if (!household || !pendingTaskRemove) return;
    await householdStore.removeTask(pendingTaskRemove.id);
    setPendingTaskRemove(null);
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
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
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
                <Icon name="user-plus" /> добавить
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
                      <Icon name="trash" />
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
            {tasks.map((t) =>
              editingTask === t.id ? (
                <div className="list-row" key={t.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                  <input
                    className="inline-input"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTask();
                      if (e.key === 'Escape') setEditingTask(null);
                    }}
                    aria-label="Название задачи"
                    autoFocus
                  />
                  <input
                    type="date"
                    value={draft.dueAt}
                    onChange={(e) => setDraft((d) => ({ ...d, dueAt: e.target.value }))}
                    aria-label="Срок задачи"
                  />
                  <select
                    value={draft.repeat}
                    onChange={(e) => setDraft((d) => ({ ...d, repeat: e.target.value as Repeat }))}
                    aria-label="Повтор"
                  >
                    {repeats.map((r) => (
                      <option key={r} value={r}>
                        {repeatLabels[r].ru}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.assignee}
                    onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                    aria-label="Исполнитель"
                  >
                    <option value="">Без исполнителя</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={() => void saveTask()}
                    disabled={draft.title.trim().length === 0}
                  >
                    Сохранить
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditingTask(null)}>
                    Отмена
                  </button>
                </div>
              ) : (
                <div className="list-row" key={t.id}>
                  <button
                    className={`check ${t.status === 'done' ? 'check-done' : ''}`}
                    onClick={() => void toggle(t.id)}
                    aria-label={t.status === 'done' ? 'Снять отметку' : 'Отметить выполненной'}
                  >
                    {t.status === 'done' && <Icon name="check" />}
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
                  {t.repeat !== 'none' && (
                    <span className="list-row-meta" title={repeatLabels[t.repeat].ru}>
                      <Icon name="repeat" />
                    </span>
                  )}
                  {nameOf(t.assigneeMembershipId) && (
                    <span className="list-row-meta">{nameOf(t.assigneeMembershipId)}</span>
                  )}
                  <button
                    className="reveal-btn"
                    onClick={() => startEdit(t)}
                    aria-label={`Изменить задачу «${t.title}»`}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="reveal-btn"
                    onClick={() => setPendingTaskRemove(t)}
                    aria-label={`Удалить задачу «${t.title}»`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ),
            )}
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
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label="Повтор">
              {repeats.map((r) => (
                <option key={r} value={r}>
                  {repeatLabels[r].ru}
                </option>
              ))}
            </select>
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

      {pendingTaskRemove && (
        <ConfirmDialog
          title={`Удалить задачу «${pendingTaskRemove.title}»?`}
          confirmLabel="Удалить"
          danger
          onConfirm={() => void confirmTaskRemove()}
          onCancel={() => setPendingTaskRemove(null)}
        />
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
