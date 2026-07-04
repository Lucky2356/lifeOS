# Life OS — Карта API (высокоуровневая)

> Версионирование с первого дня: базовый префикс `/api/v1`. Контракты и OpenAPI генерируются из
> `packages/contracts`. Данные пользовательских модулей в основном идут через sync-канал (local-first
> движок), REST/RPC используется для команд, аутентификации, файлов, контента и AI-точек.

## Каналы
- **Sync-канал** (движок offline-first): реплика чтения/записи Ledger, Household-задач, Decision и т.п.
  Клиент работает с локальной SQLite; сервер — авторитет и разрешение конфликтов.
- **REST/RPC `/api/v1`**: то, что не ложится на чистую репликацию — auth/MFA, загрузка файлов, вызовы
  AI, управление content packs, экспорт/удаление аккаунта, инвайты.

## IAM / Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login` → шаг MFA при включённом
- `POST /api/v1/auth/mfa/verify`
- `POST /api/v1/auth/mfa/setup` (TOTP/passkey)
- `POST /api/v1/auth/token/refresh`
- `POST /api/v1/auth/logout` / `POST /api/v1/auth/sessions/revoke`
- `GET  /api/v1/auth/sessions` — список активных сессий/устройств

## Аккаунт / приватность
- `GET  /api/v1/account/export` — экспорт всех данных пользователя
- `DELETE /api/v1/account` — полное удаление аккаунта и данных («право на забвение»)
- `GET/PUT /api/v1/account/ai-settings` — глобальный + помодульные тумблеры ИИ, приватность

## Household OS
- `POST /api/v1/households` / `GET /api/v1/households/:id`
- `POST /api/v1/households/:id/invites` — инвайт с ролью, `expires_at` для гостя
- `POST /api/v1/invites/:token/accept`
- `PUT  /api/v1/households/:id/members/:mid` — роль/права
- `POST /api/v1/shares` — выдать SHARE_GRANT (resource + access_level)
- `GET  /api/v1/households/:id/audit` — журнал доступа (owner/adult)

## Life Ledger
- Основное CRUD — через sync-канал. REST-дополнения:
- `GET  /api/v1/object-types` — справочник типов (ядро + из активного пака)
- `POST /api/v1/objects/:id/attachments` — загрузка файла (валидация типа/размера, очередь скана)
- `GET  /api/v1/attachments/:id` — выдача (проверка прав + расшифровка)
- `GET  /api/v1/reminders/upcoming` — ближайшие напоминания (правила, без ИИ)

## Decision Companion
- CRUD решений/критериев/опций — через sync-канал; расчёт взвешивания — на клиенте из общего домена.
- `POST /api/v1/decisions/:id/outcome` — зафиксировать/обновить исход (для анализа паттернов).

## Content Packs
- `GET  /api/v1/content/packs` — список установленных паков и версий
- `GET  /api/v1/content/packs/:packId/:version` — метаданные/содержимое
- `GET  /api/v1/content/playbooks?region=ru&locale=ru`
- `GET  /api/v1/content/guides?region=ru&locale=ru`
- `POST /api/v1/content/packs/install` — установка/обновление пака (admin/локально)

## Bureaucracy Autopilot / Crisis Navigator
- `POST /api/v1/playbooks/:key/start` — создать PLAYBOOK_PROGRESS (привязка к данным Ledger)
- `PUT  /api/v1/playbook-progress/:id/steps/:stepId` — отметить шаг/статус
- `GET  /api/v1/playbook-progress/:id` — прогресс + подсказка следующего шага (по данным пользователя)
- Аналогично `guides` / `guide-progress` для Bureaucracy.

## AI Layer (опционально, только по явному действию)
- `POST /api/v1/ai/suggest` — единая точка: `{ context, module, action }` → предложение
  (или `409/403 "ai_disabled"` при выключенном тумблере). Ответ всегда помечается как AI-предложение.
- Никаких фоновых/автоматических AI-вызовов на core-путях.

## Сквозное
- Все эндпоинты: аутентификация, rate limiting, row-level авторизация (в дополнение к RLS в БД).
- Ошибки — единый формат, без утечки внутренней информации.
- OpenAPI-спека публикуется из `packages/contracts`; изменения версии API — по semver.
