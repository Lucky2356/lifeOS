# Life OS

Персональная и семейная «операционная система для жизни»: единый реестр данных о жизни человека,
который в спокойном режиме держит порядок, а в кризис подсказывает конкретные следующие шаги.

> **Ключевой принцип:** ИИ — опциональный ассистент поверх системы, а не её фундамент.
> Любая функция работает и без ИИ. ИИ можно выключить глобально и по модулям без деградации core-функций.

## Статус

🚧 **Фаза 1 — Архитектура и дизайн.** Код приложения ещё не пишется до утверждения архитектуры.

## Модули

| Модуль                    | Роль                                                                                    | Приоритет разработки |
| ------------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| **Life Ledger**           | Ядро: реестр «объектов жизни» (документы, вещи, подписки, страховки, здоровье, финансы) | 1                    |
| **Household OS**          | Тот же реестр на семью/дом: роли, права, общие задачи и расходы, синхронизация          | 2                    |
| **Decision Companion**    | Сквозной фреймворк принятия решений + журнал исходов                                    | 3                    |
| **Bureaucracy Autopilot** | Региональные пошаговые гиды по бюрократии (через content packs)                         | 4                    |
| **Crisis Navigator**      | Плейбуки тяжёлых ситуаций, привязанные к данным Ledger                                  | 5                    |

## Стек (утверждён)

- **Клиент:** React + Vite (PWA), TypeScript strict, Tailwind + Radix, TanStack Query/Router
- **Offline-first sync:** local-first движок (ElectricSQL / PowerSync) поверх PostgreSQL
- **Бэкенд:** NestJS (TypeScript), PostgreSQL, Drizzle ORM
- **Монорепо:** pnpm + Turborepo, общий пакет доменной модели (переиспользование в будущих desktop/mobile)
- **Хостинг на старте:** локально (Docker Compose)

## Документация

- [PRD](docs/PRD.md) — продуктовые требования MVP
- [Архитектура](docs/ARCHITECTURE.md) — компоненты, границы модулей, sync
- [Модель данных](docs/DATA_MODEL.md) — доменные сущности и схема БД
- [API](docs/API.md) — высокоуровневая карта API
- [RBAC](docs/RBAC.md) — роли и права доступа
- [Безопасность / Threat Model](docs/SECURITY.md)
- [Операции / CI-CD](docs/OPERATIONS.md) — окружения, миграции, мониторинг, backup/DR
- [Дизайн-система](docs/DESIGN.md)
- [ADR](docs/adr/) — журнал архитектурных решений
- [CHANGELOG](CHANGELOG.md)

## CI и безопасность

Каждый push/PR прогоняет блокирующие гейты (`.github/workflows/`): lint + format, типы, тесты,
валидация content-pack, **SCA** (аудит зависимостей), **secret scanning** (gitleaks), **SAST** (CodeQL).
Локально: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm validate:content`.

## Быстрый старт (локально)

Требуется Node ≥ 22 и pnpm. Для персистентной БД — Docker.

```bash
pnpm install

# Вариант A — без БД (zero-config, in-memory):
pnpm --filter @life-os/api dev            # API на http://localhost:3011
pnpm --filter @life-os/web dev            # Web на http://localhost:5173

# Вариант B — с PostgreSQL:
docker compose -f infra/docker/docker-compose.yml up -d
cp apps/api/.env.example apps/api/.env    # DATABASE_URL уже указывает на порт 5433
pnpm --filter @life-os/api build
pnpm --filter @life-os/api db:migrate     # применить миграции
pnpm --filter @life-os/api dev
```

Тесты: `pnpm -r test`. Сборка всего: `pnpm build`.

## Процесс

Разработка ведётся по фазам с чек-поинтами: Фаза 0 (PRD) → Фаза 1 (архитектура) → Фаза 2 (UX)
→ Фаза 3 (итеративная разработка вертикальными срезами) → Фаза 5 (продакшен).
Безопасность (Фаза 4) — сквозная на всех этапах.
