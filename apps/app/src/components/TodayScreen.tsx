import { useEffect, useState } from 'react';
import {
  daysUntil,
  lifecycleFor,
  objectTypeLabels,
  type HouseholdTask,
  type LifeObject,
} from '@life-os/domain';
import { householdStore, ledgerStore } from '../lib/store';
import { counted, formatDate } from '../lib/format';
import { backupIsStale, lastBackupAt } from '../lib/backup';
import { lifecyclePill, typeIcons } from '../lib/object-visuals';
import type { Theme } from '../lib/theme';
import { Icon } from './Icon';

const order = { overdue: 0, due_soon: 1, ok: 2, none: 3 } as const;

export function TodayScreen({
  theme,
  onToggleTheme,
  onOpenObject,
  onOpenSettings,
  onOpenLedger,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenObject: (id: string) => void;
  onOpenSettings: () => void;
  onOpenLedger: () => void;
}) {
  const [attention, setAttention] = useState<LifeObject[] | null>(null);
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
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
  const urgentTasks = tasks.filter((t) => (daysUntil(t.dueAt) ?? 1) <= 0).length;
  // Ничего не внесено — «всё под контролем» здесь было бы неправдой и ничего не подсказывало бы.
  const empty = attention !== null && totalObjects === 0 && tasks.length === 0;
  const flaggedObjects = attention?.length ?? 0;
  const count = flaggedObjects + urgentTasks;

  if (failed) {
    return (
      <main className="main">
        <div className="serif page-title" style={{ marginBottom: 8 }}>
          Не удалось прочитать данные
        </div>
        <div className="page-sub" style={{ maxWidth: 520, marginBottom: 18 }}>
          Хранилище на этом устройстве недоступно. Попробуйте перезапустить приложение.
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Перезапустить
        </button>
      </main>
    );
  }

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="page-sub" style={{ marginBottom: 2 }}>
            {new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(
              new Date(),
            )}
          </div>
          <div className="serif page-title">Доброе утро</div>
          <div className="page-sub" style={{ marginTop: 4 }}>
            {attention === null
              ? 'Загрузка…'
              : empty
                ? 'Здесь появится то, что требует внимания.'
                : count === 0
                  ? 'Всё под контролем. Ничего срочного.'
                  : `${counted(count, 'дело', 'дела', 'дел')} ${count === 1 ? 'просит' : 'просят'} внимания. Остальное под контролем.`}
          </div>
        </div>
        <button className="btn" onClick={onToggleTheme} aria-label="Переключить тему">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      {backupStale && (
        <div className="hint" style={{ marginBottom: 20 }} role="status">
          <Icon name="download" />
          <span style={{ flex: 1 }}>
            Данные хранятся только на этом устройстве, и резервной копии давно не было. Копия занимает минуту
            и спасает при потере или сбросе телефона.
          </span>
          <button className="btn" onClick={onOpenSettings}>
            Сохранить копию
          </button>
        </div>
      )}

      {flaggedObjects > 0 && (
        <>
          <div className="section-label">Требует внимания</div>
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
                    <span className="page-sub"> · {objectTypeLabels[o.type].ru}</span>
                  </span>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <div className="section-label">Дом · задачи</div>
          <div className="list-card">
            {tasks.map((t) => (
              <div className="list-row" key={t.id}>
                <span className="check" aria-hidden="true" />
                <span style={{ flex: 1 }}>{t.title}</span>
                {t.dueAt && (
                  <span
                    className="list-row-meta"
                    style={{
                      color: lifecycleFor(t.dueAt) === 'overdue' ? 'var(--brick-ink)' : 'var(--ink-3)',
                    }}
                  >
                    {formatDate(t.dueAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {empty && (
        <div className="state" style={{ textAlign: 'left', maxWidth: 640 }}>
          <div style={{ fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>С чего начать</div>
          <div style={{ marginBottom: 14 }}>
            Life OS держит в одном месте документы, вещи и обязательства — и напоминает о сроках заранее. Всё
            хранится на этом устройстве и никуда не отправляется.
          </div>
          <ol style={{ margin: '0 0 16px', paddingLeft: 20, lineHeight: 1.9 }}>
            <li>Добавьте первый документ со сроком — например, паспорт или страховку.</li>
            <li>Приложите скан, чтобы он был под рукой, когда понадобится.</li>
            <li>Разрешите уведомления в настройках, чтобы срок не застал врасплох.</li>
            <li>Сохраните резервную копию: другой копии этих данных не существует.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onOpenLedger}>
              Добавить первый объект
            </button>
            <button className="btn" onClick={onOpenSettings}>
              Открыть настройки
            </button>
          </div>
        </div>
      )}

      {attention !== null && !empty && count === 0 && tasks.length === 0 && (
        <div className="state">Спокойный день — система держит ваши дела под контролем.</div>
      )}
    </main>
  );
}
