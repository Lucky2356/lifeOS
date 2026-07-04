# Changelog

Все значимые изменения проекта. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается семантического версионирования.

## [Unreleased]

### Added
- Фаза 0: PRD (`docs/PRD.md`) — утверждён.
- Фаза 1: архитектурная документация — компоненты, доменная модель, схема БД, карта API, RBAC, threat model.
- ADR 0001–0005: стек, стиль архитектуры, offline-sync, content packs, AI-слой.
- Фаза 2: дизайн-язык «Calm Sanctuary», две темы с переключателем, 6 ключевых экранов (`docs/DESIGN.md`).
- Фаза 3, срез Life Ledger (vertical slice):
  - Каркас монорепо: pnpm + Turborepo, `tsconfig.base.json`.
  - `@life-os/domain`: Zod-схемы `LifeObject`, правила напоминаний/жизненного цикла, UUIDv7, 13 тестов.
  - `@life-os/api` (NestJS 11): CRUD объектов, порт репозитория + in-memory реализация, изоляция
    на уровне строки (owner-scoped), Zod-валидация на границе, 6 тестов. Проверено сквозным HTTP-сценарием.
  - `@life-os/web` (React 19 + Vite PWA): экран «Реестр», токены обеих тем + переключатель,
    подключение к живому API, пилюли жизненного цикла из общего домена, создание объекта.
  - PostgreSQL + Drizzle как swap-in через тот же порт репозитория; `infra/docker/docker-compose.yml`
    (Postgres 17, порт 5433), миграции Drizzle. Без `DATABASE_URL` — in-memory. Персистентность
    проверена перезапуском сервера.
  - Экран «Карточка объекта»: поля, маскировка чувствительных значений с раскрытием, предстоящие
    напоминания (правила `defaultReminderRules`, без ИИ), редактирование (PATCH → бамп версии),
    soft-delete, история по версии. Домен: `upcomingReminders` + `defaultReminderRules` (15 тестов).
    Проверено вживую в браузере (маскировка, правка даты → пересчёт напоминаний, версия 0→1).
- Фаза 3, остальные модули (домен + API + web-экраны, проверено в браузере):
  - **Household OS**: RBAC (роли owner/adult/child/guest, матрица `can`), участники, общие задачи,
    журнал доступа (audit), проверка прав в сервисе. Экран «Дом».
  - **Decision Companion**: критерии/варианты, взвешенный итог `scoreOptions`, журнал решений. Экран «Решения».
  - **Bureaucracy + Crisis (Navigator)**: content-pack движок, пак РФ (`content-packs/ru/pack.json`,
    4 сценария), прогресс по шагам, привязка шагов к типам документов реестра. Экран «Навигатор».
  - Экран «Сегодня»: спокойная сводка «требует внимания» (агрегация реестра по жизненному циклу) + задачи дома.
  - PWA: манифест + service worker (офлайн app-shell, installable).
- Домен: 28 тестов; API: 15 тестов. Единый паттерн «порт репозитория» во всех модулях.

### Notes / остаётся
- Persistence: Life Ledger на PostgreSQL/Drizzle; Household/Decision/Navigator — in-memory за тем же
  портом (Drizzle-swap-in — механический следующий шаг). Полный offline-first данных — local-first
  движок (ADR 0003), продовая задача. AI-слой — опциональный, отдельный будущий срез (ADR 0005).

### Security
- Валидация входа Zod на границе API; `.env` вне git; owner-scoped доступ в репозитории (задел под RLS).
