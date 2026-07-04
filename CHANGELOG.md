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

### Security
- Валидация входа Zod на границе API; `.env` вне git; owner-scoped доступ в репозитории (задел под RLS).
