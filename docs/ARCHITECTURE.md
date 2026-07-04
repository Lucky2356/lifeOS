# Life OS — Архитектура

> Статус: черновик Фазы 1. Стиль — модульный монолит (ADR 0002), TS-монорепо (ADR 0001).

## 1. Высокоуровневая структура (монорепо)

```
life-os/
├─ apps/
│  ├─ web/            # React + Vite PWA (первый клиент)
│  └─ api/            # NestJS backend (модульный монолит)
├─ packages/
│  ├─ domain/         # общая доменная модель: сущности, типы, Zod-схемы, бизнес-правила (без I/O)
│  ├─ contracts/      # API-контракты (типы запросов/ответов, OpenAPI-генерация)
│  ├─ content-schema/ # схема content packs + валидатор
│  └─ ui/             # общие UI-компоненты/дизайн-система (переиспользование web/desktop/mobile)
├─ content-packs/
│  └─ ru/             # первый пак (регион РФ, локали ru/en)
├─ infra/
│  └─ docker/         # docker-compose: postgres, sync-engine, api
└─ docs/
```
Будущие клиенты (`apps/desktop` на Tauri, `apps/mobile` на Expo) переиспользуют `packages/domain`,
`packages/contracts`, `packages/ui` — общая логика не дублируется.

## 2. Модули бэкенда (границы — ADR 0002)

```mermaid
graph TB
    subgraph Clients["Клиенты"]
        WEB["Web PWA<br/>(локальный SQLite + sync)"]
    end

    subgraph Sync["Sync Layer"]
        SE["Local-first движок<br/>(PowerSync/Electric)"]
    end

    subgraph API["NestJS — модульный монолит"]
        IAM["IAM<br/>(auth, MFA, сессии)"]
        LEDGER["Life Ledger<br/>(объекты жизни)"]
        HOUSE["Household OS<br/>(дом, роли, шаринг, аудит)"]
        DECISION["Decision Companion"]
        CONTENT["Content Pack Engine"]
        BUREAU["Bureaucracy Autopilot"]
        CRISIS["Crisis Navigator"]
        REMIND["Reminders<br/>(правила, без ИИ)"]
        FILES["Files/Attachments<br/>(валидация, изоляция)"]
        AUDIT["Audit Log"]
        AI["AI Layer (опционально)<br/>port + провайдеры"]
        BILLING["Billing (заглушка,<br/>вне core)"]
    end

    subgraph Data["Хранилище"]
        PG[("PostgreSQL<br/>RLS")]
        OBJ[("Object storage<br/>шифрованные файлы")]
        KMS[["KMS / secret manager"]]
    end

    WEB <--> SE
    SE <--> IAM
    SE <--> LEDGER
    LEDGER --> REMIND
    LEDGER --> FILES
    HOUSE --> LEDGER
    HOUSE --> AUDIT
    DECISION -. порт .-> LEDGER
    CRISIS --> CONTENT
    CRISIS -. порт .-> LEDGER
    BUREAU --> CONTENT
    BUREAU -. порт .-> LEDGER
    AI -. подписка на точки расширения .-> LEDGER
    AI -. .-> DECISION
    AI -. .-> CRISIS
    LEDGER --> PG
    HOUSE --> PG
    DECISION --> PG
    CONTENT --> PG
    FILES --> OBJ
    FILES --> KMS
    IAM --> KMS
```

**Правила зависимостей:**
- Core-модули (Ledger, Household, Decision) **не зависят** от AI и Billing.
- Кросс-модульные вызовы — только через публичные порты (интерфейсы), не через прямой импорт.
- Household «надстраивается» над Ledger через порт Ledger (не дублирует сущности объектов).
- Crisis/Bureaucracy зависят от Content Engine + читают данные пользователя через порт Ledger.
- AI подписывается на «точки расширения» core, инверсия зависимости (ADR 0005).

## 3. Синхронизация (ADR 0003)
- Клиент читает/пишет в локальную SQLite → работает офлайн.
- Sync-движок реплицирует с PostgreSQL, near-realtime при онлайне.
- Разрешение конфликтов: HLC-LWW для полей, add-wins для множеств, явное разрешение для критичных полей.
- Все записи несут sync-метаданные: `id` (UUIDv7), `updated_at`, `hlc`, `deleted_at`, `version`.

## 4. Content Packs (ADR 0004)
- Декларативные данные по строгой схеме (`packages/content-schema`), валидируются в CI.
- Плейбуки/гиды ссылаются на абстрактные типы документов; движок сопоставляет с объектами Ledger.
- Версионирование semver, независимое обновление без релиза приложения.

## 5. AI-слой (ADR 0005)
- Отдельный опциональный модуль, порт `AiProvider`, провайдеры Noop/Claude.
- Только по явному действию пользователя; глобальный + помодульные тумблеры; UI-маркировка предложений.

## 6. Нефункциональные сквозные заботы
- **Безопасность** — см. [SECURITY.md](SECURITY.md) (сквозная, threat model до кодирования core).
- **i18n/a11y** — часть `packages/ui` и content-движка с первого дня.
- **Наблюдаемость** — структурированные логи без PII, health-checks, аудит-лог доступа к данным дома.
- **Версионирование API** — с первого дня (`/api/v1`), OpenAPI из `packages/contracts`.
