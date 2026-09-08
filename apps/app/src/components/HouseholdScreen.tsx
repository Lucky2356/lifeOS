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
import { formatDate } from '../lib/format';
import type { Theme } from '../lib/theme';
import { ConfirmDialog } from './Dialog';
import { Icon } from './Icon';
import { useLocale, useT, type TFunction } from '../lib/i18n';

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
/** Подпись под заголовком: три состояния, и обе части счётчика склоняются по своему числу. */
function summary(t: TFunction, loading: boolean, hasHousehold: boolean, people: number, open: number) {
  if (loading) return t('app.loading');
  if (!hasHousehold) return t('household.subtitle');
  return t('household.summary', {
    people: t('household.people', { n: people }),
    tasks: t('household.openTasks', { n: open }),
  });
}

export function HouseholdScreen({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const t = useT();
  const locale = useLocale();
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
    const [people, loaded] = await Promise.all([householdStore.members(id), householdStore.tasks(id)]);
    setMembers(people);
    setTasks(loaded);
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
    const h = await householdStore.create(
      t('household.defaultName'),
      myName.trim() || t('household.defaultSelf'),
    );
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
  const openCount = tasks.filter((task) => task.status === 'open').length;

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="serif page-title">{t('household.title')}</div>
          <div className="page-sub">{summary(t, loading, household !== null, members.length, openCount)}</div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label={t('theme.toggle')}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      {!loading && !household && (
        <div className="state">
          {t('household.intro')}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <input
              className="inline-input"
              style={{ maxWidth: 220 }}
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createHouse()}
              placeholder={t('household.yourName')}
              aria-label={t('household.yourName')}
            />
            <button className="btn btn-primary" onClick={() => void createHouse()}>
              {t('household.create')}
            </button>
          </div>
        </div>
      )}

      {household && (
        <>
          <div className="section-label">
            {t('household.peopleSection')}
            {!adding && (
              <button className="reveal-btn" onClick={() => setAdding(true)}>
                <Icon name="user-plus" /> {t('household.addPerson')}
              </button>
            )}
          </div>

          {adding && (
            <div className="list-card" style={{ marginBottom: 14, padding: 14 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <label className="page-sub" htmlFor="member-name">
                  {t('household.name')}
                </label>
                <input
                  id="member-name"
                  className="inline-input"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submitMember()}
                  placeholder={t('household.namePlaceholder')}
                  autoFocus
                />
                <label className="page-sub" htmlFor="member-rel">
                  {t('household.relationship')}
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
                        {relationshipLabels[r][locale]}
                      </option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => void submitMember()}
                    disabled={mName.trim().length === 0}
                  >
                    {t('household.add')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setAdding(false)}>
                    {t('dialog.cancel')}
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
                    <div className="card-meta">{relationshipLabels[m.relationship][locale]}</div>
                  </div>
                  {m.relationship !== 'self' && (
                    <button
                      className="reveal-btn"
                      onClick={() => setPendingRemove(m)}
                      aria-label={t('household.remove', { name: m.displayName })}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="section-label">{t('household.tasksSection')}</div>
          <div className="list-card" style={{ marginBottom: 14 }}>
            {tasks.length === 0 && (
              <div className="list-row" style={{ color: 'var(--ink-3)' }}>
                {t('household.noTasks')}
              </div>
            )}
            {tasks.map((task) =>
              editingTask === task.id ? (
                <div className="list-row" key={task.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                  <input
                    className="inline-input"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTask();
                      if (e.key === 'Escape') setEditingTask(null);
                    }}
                    aria-label={t('household.taskTitle')}
                    autoFocus
                  />
                  <input
                    type="date"
                    value={draft.dueAt}
                    onChange={(e) => setDraft((d) => ({ ...d, dueAt: e.target.value }))}
                    aria-label={t('household.taskDue')}
                  />
                  <select
                    value={draft.repeat}
                    onChange={(e) => setDraft((d) => ({ ...d, repeat: e.target.value as Repeat }))}
                    aria-label={t('household.taskRepeat')}
                  >
                    {repeats.map((r) => (
                      <option key={r} value={r}>
                        {repeatLabels[r][locale]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.assignee}
                    onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                    aria-label={t('household.taskAssignee')}
                  >
                    <option value="">{t('household.noAssignee')}</option>
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
                    {t('household.save')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditingTask(null)}>
                    {t('dialog.cancel')}
                  </button>
                </div>
              ) : (
                <div className="list-row" key={task.id}>
                  <button
                    className={`check ${task.status === 'done' ? 'check-done' : ''}`}
                    onClick={() => void toggle(task.id)}
                    aria-label={task.status === 'done' ? t('household.taskUndone') : t('household.taskDone')}
                  >
                    {task.status === 'done' && <Icon name="check" />}
                  </button>
                  <span
                    style={{
                      flex: 1,
                      textDecoration: task.status === 'done' ? 'line-through' : 'none',
                      color: task.status === 'done' ? 'var(--ink-3)' : 'var(--ink)',
                    }}
                  >
                    {task.title}
                  </span>
                  {task.dueAt && task.status === 'open' && (
                    <span
                      className="list-row-meta"
                      style={{
                        color: lifecycleFor(task.dueAt) === 'overdue' ? 'var(--brick-ink)' : 'var(--ink-3)',
                      }}
                    >
                      {formatDate(task.dueAt)}
                    </span>
                  )}
                  {task.repeat !== 'none' && (
                    <span className="list-row-meta" title={repeatLabels[task.repeat][locale]}>
                      <Icon name="repeat" />
                    </span>
                  )}
                  {nameOf(task.assigneeMembershipId) && (
                    <span className="list-row-meta">{nameOf(task.assigneeMembershipId)}</span>
                  )}
                  <button
                    className="reveal-btn"
                    onClick={() => startEdit(task)}
                    aria-label={t('household.editTask', { title: task.title })}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="reveal-btn"
                    onClick={() => setPendingTaskRemove(task)}
                    aria-label={t('household.deleteTask', { title: task.title })}
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
              placeholder={t('household.newTask')}
            />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              aria-label={t('household.taskDue')}
            />
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as Repeat)}
              aria-label={t('household.taskRepeat')}
            >
              {repeats.map((r) => (
                <option key={r} value={r}>
                  {repeatLabels[r][locale]}
                </option>
              ))}
            </select>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-label={t('household.taskAssignee')}
            >
              <option value="">{t('household.noAssignee')}</option>
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
              {t('household.add')}
            </button>
          </div>
        </>
      )}

      {pendingTaskRemove && (
        <ConfirmDialog
          title={t('household.deleteTaskTitle', { title: pendingTaskRemove.title })}
          confirmLabel={t('household.deleteConfirm')}
          danger
          onConfirm={() => void confirmTaskRemove()}
          onCancel={() => setPendingTaskRemove(null)}
        />
      )}

      {pendingRemove && (
        <ConfirmDialog
          title={t('household.removeTitle', { name: pendingRemove.displayName })}
          confirmLabel={t('household.removeConfirm')}
          danger
          onConfirm={() => void confirmRemove()}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </main>
  );
}
