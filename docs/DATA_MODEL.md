# Модель данных

Источник правды — Zod-схемы в `packages/domain/src`. Хранилище — одна база IndexedDB `life-os` на
устройстве ([ADR 0006](adr/0006-local-only.md)); ни сервера, ни синхронизации нет.

## Общие поля

Пользовательские сущности расширяют `baseEntitySchema` (`sync.ts`):

| Поле                      | Тип              | Зачем                                                              |
| ------------------------- | ---------------- | ------------------------------------------------------------------ |
| `id`                      | UUIDv7           | первичный ключ; сортируется по времени создания                    |
| `createdAt` / `updatedAt` | ISO-8601         | когда создано и когда правилось                                    |
| `version`                 | int ≥ 0          | растёт при каждой правке; используется при разборе резервных копий |
| `deletedAt`               | ISO-8601 \| null | tombstone; локально удаление обычное, поле осталось для импорта    |

Заглушки HLC больше нет: она существовала под движок синхронизации, которого не будет.

## Хранилища IndexedDB

Схема задаётся в `apps/app/src/lib/store/db.ts`, версия базы — 1.

| Хранилище     | Ключ        | Индексы        | Что лежит                                                      |
| ------------- | ----------- | -------------- | -------------------------------------------------------------- |
| `objects`     | `id`        | —              | `LifeObject` — объекты реестра                                 |
| `decisions`   | `id`        | —              | `Decision` — решения с критериями и вариантами                 |
| `households`  | `id`        | —              | `Household` — дом (на устройстве он один)                      |
| `members`     | `id`        | `by-household` | `Membership` — люди дома                                       |
| `tasks`       | `id`        | `by-household` | `HouseholdTask` — общие задачи                                 |
| `progress`    | `id`        | —              | `PlaybookProgress` — прогресс по плейбукам                     |
| `attachments` | `id`        | `by-object`    | `Attachment` — метаданные вложений                             |
| `files`       | id вложения | —              | `ArrayBuffer` — сами байты файла                               |
| `settings`    | строка      | —              | служебное: id владельца, показанные напоминания, флаг миграции |

## Сущности

### LifeObject (`life-object.ts`)

`householdId`, `ownerUserId`, `type` (8 типов из `object-types.ts`), `title`, `data` (свободный
объект под тип), `status` (`active` / `archived`), `sensitivity` (`normal` / `sensitive` / `high`),
`validFrom`, `validUntil`.

`validUntil` — то, из чего считаются напоминания и состояние жизненного цикла (`lifecycleFor`:
`overdue` / `due_soon` / `ok` / `none`).

### Attachment (`attachment.ts`)

`objectId`, `ownerUserId`, `filename`, `mime`, `size`, `sensitivity`, `createdAt`.

- Тип определяется по «магическим байтам» содержимого (`sniffAttachmentMime`), а не по расширению и
  не по MIME, который сообщает система. Разрешены PDF, JPEG, PNG, WebP, HEIC.
- Лимит — 25 МБ (`maxAttachmentBytes`).
- `sensitivity` наследуется от объекта: скан паспорта не менее чувствителен, чем сам паспорт.
- Удаление объекта каскадно удаляет его вложения и их байты.
- Поля `encryptionKeyId` больше нет: файлы на устройстве не шифруются (см. [SECURITY.md](SECURITY.md)).

### Household / Membership / HouseholdTask

- `Household`: `name`, `createdBy`. На устройстве создаётся один дом.
- `Membership`: `householdId`, `userId`, `displayName`, `role`, `relationship`. Роль локально ничего
  не разрешает и не запрещает — это пометка «кто это в доме»; в интерфейсе показывается
  родственный статус. Ролевой матрицы, share-грантов и гостевых сроков нет.
- `HouseholdTask`: `householdId`, `title`, `assigneeMembershipId`, `dueAt`, `status` (`open`/`done`).
  Удаление человека снимает его с задач, сами задачи остаются.

### Decision (`decision.ts`)

`ownerUserId`, `title`, `context`, `status` (`draft`/`decided`), `criteria[]` (label + weight 1..5),
`options[]` (label + `scores` по criterionId, 0..5), `chosenOptionId`, `expectedOutcome`,
`actualOutcome`, `decidedAt`.

Балл варианта — `Σ(weight × score)` (`scoreOptions`), отсортировано по убыванию.

### PlaybookProgress (`content.ts`)

`ownerUserId`, `packId`, `packVersion`, `playbookKey`, `stepStates` (ключ шага → выполнен),
`startedAt`, `completedAt`. Один прогресс на плейбук: повторный старт возвращает начатый.

Сами плейбуки — не данные пользователя, а контент: они приходят из вшитого пака
(`content-packs/ru/pack.json`, схема `contentPackSchema`).

## Резервная копия

Формат — `backupSchema` в `apps/app/src/lib/backup.ts`:

```json
{
  "app": "life-os",
  "schema": 1,
  "exportedAt": "2026-08-19T12:00:00.000Z",
  "appVersion": "1.0.0",
  "objects": [],
  "decisions": [],
  "households": [],
  "members": [],
  "tasks": [],
  "progress": [],
  "attachments": [{ "…метаданные Attachment": null, "data": "<base64>" }]
}
```

Импорт проверяет файл теми же доменными схемами и заменяет содержимое базы целиком. Метаданные
вложения без байтов в копию не попадают — копия не должна обещать того, чего в ней нет.

## Миграции

- **Схема IndexedDB**: `DB_VERSION` в `db.ts`; в `upgrade` создаётся только отсутствующее, поэтому
  следующая версия дописывает свои изменения, не ломая существующие данные.
- **С прежнего локального режима**: `migrate-localstorage.ts` один раз переносит старые ключи
  `los-*` из localStorage в IndexedDB, проверяя каждую запись схемой; битые записи пропускаются,
  затем ключи удаляются. Тема (`los-theme`) остаётся в localStorage.
