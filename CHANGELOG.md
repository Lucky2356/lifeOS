# Changelog

Все значимые изменения проекта. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается семантического версионирования.

## [Unreleased]

### Added

- **Единый дизайн форм и диалогов**: общий базовый стиль всех полей (input/select/textarea) с
  одинаковыми границами, фоном, скруглением и состоянием фокуса (шалфейная рамка) — ничто больше не
  падает в браузерный дефолт. Клавиатурный фокус (`:focus-visible`) для кнопок/карточек. Нативные
  `window.prompt`/`confirm` заменены внутренними диалогами в стиле приложения (переиспользуемый
  `Dialog`: `PromptDialog` для «Новое решение», `ConfirmDialog` для удаления объекта).
- **Больше провайдеров ИИ** (#7): помимо Claude — OpenAI (GPT), DeepSeek, Google Gemini и «Другой»
  (любой OpenAI-совместимый: Groq, Mistral, OpenRouter, локальный Ollama). Выбор в настройках; ключ
  задаётся на сервере (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `AI_CUSTOM_*`). Без
  ключа — Noop, приложение работает как обычно. Провайдеры: OpenAI-совместимый адаптер + Gemini-адаптер.
- **Родственные статусы в Доме и приглашение по e-mail** (#6): у участника теперь есть статус (муж,
  жена, партнёр, ребёнок, родитель, тёща/свекровь, зять и др.) отдельно от роли-прав. Реального
  человека добавляют по e-mail (`POST /households/:id/members/invite`) — если он зарегистрирован,
  создаётся членство с ролью по умолчанию из статуса. Панель добавления переписана (пригласить по
  почте / добавить без аккаунта). Миграция `0002` (колонка `relationship`).
- **Десктоп запоминает окно** (#1): `tauri-plugin-window-state` — размер, позиция и развёрнутость
  восстанавливаются между запусками.

### Security

- **Убран общий секрет по умолчанию** (#8): `JWT_SECRET`/`ENCRYPTION_KEY` больше не завязаны на
  публичный дефолт из исходников (иначе токены можно было бы подделать на любой чужой установке).
  Если стойкий секрет не задан, API генерирует случайный и хранит его в таблице `app_secrets`
  (миграция `0003`) — уникально на установку, стабильно между перезапусками, без ручной настройки.

### Fixed

- **Данные не сохранялись / вылеты из аккаунта** (#3, #4): API теперь применяет миграции автоматически
  при старте (идемпотентно) — таблицы всегда существуют. `docker-compose.prod` открывает порт API
  наружу (десктоп/телефон достают его) и задаёт стабильные `JWT_SECRET`/`ENCRYPTION_KEY`. Проверено:
  регистрация → создание данных → перезапуск API → вход работает, данные на месте.

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
- Фаза 5, CI/CD и гейты безопасности:
  - GitHub Actions `ci.yml`: build, **lint** (ESLint) + **format** (Prettier), typecheck, tests,
    валидация content-pack; **SCA** (`pnpm audit --prod --audit-level=high`); **secret scanning** (gitleaks).
  - `codeql.yml`: **SAST** (CodeQL). `deploy.yml`: сборка Docker-образов (валидация артефактов).
  - Деплой-артефакты: `apps/api/Dockerfile` (multi-stage, `pnpm deploy`), `apps/web/Dockerfile` (nginx),
    `infra/docker/docker-compose.prod.yml`. API-образ собран и проверен локально (health + контент из контейнера).
  - `docs/OPERATIONS.md`: окружения, миграции expand/contract, логи без PII, backup/DR, нагрузочное тестирование.
  - ESLint (flat config) + Prettier как обязательные гейты; `scripts/validate-content.mjs`.

- Финализация:
  - **AI-слой (ADR 0005)**: provider-agnostic порт, Noop + Claude адаптеры (по ключу), настройки
    (выкл по умолчанию, помодульные тумблеры, приватность), gated `POST /ai/suggest`, экран настроек
    ИИ, блок «Предложил ИИ» с ручной альтернативой; тесты «core работает без ИИ».
  - **Структурные логи без PII** (pino/pino-http): метод/путь/статус, без тел и секретных заголовков.
  - **Экспорт/удаление аккаунта**: `GET /account/export`, `DELETE /account` — право на забвение.
  - **Релизы и автообновление**: `release.yml` (тег `v*` → GitHub Release + образы GHCR), версионируемый
    service worker с **мгновенным авто-обновлением** PWA (web/телефон/ПК), `docs/RELEASES.md`.
  - Домен: 32 теста; API: 21 тест.

- **Аутентификация + MFA (IAM)**: реальная auth вместо `DEV_USER_ID`.
  - Пароли — argon2id (`@node-rs/argon2`); TOTP MFA (`otpauth`), секрет шифруется AES-256-GCM at-rest.
  - JWT access (15м) + opaque refresh (ротация при обновлении), сессии с отзывом; список/выход сессий.
  - Глобальный `JwtAuthGuard` защищает весь API (кроме `/auth/*`, `/health`); rate-limiting (`@nestjs/throttler`)
    на auth-эндпоинтах; единообразные ошибки (защита от enumeration).
  - Web: экран входа/регистрации + шаг MFA-кода; централизованный HTTP-клиент с Bearer-токеном и авто-refresh;
    раздел «Безопасность» (включение MFA, выход). Домен: валидация IAM (35 тестов), API: auth (27 тестов).
  - Проверено вживую: 401 без токена, register→app, ownerUserId из токена, logout очищает сессию.

- **Полная персистентность в PostgreSQL**: Drizzle-репозитории для всех модулей (IAM users/sessions,
  Household + memberships/tasks/audit, Decision, AI settings, Navigator progress) через тот же порт-паттерн.
  Глобальный `DatabaseModule`; без `DATABASE_URL` — in-memory (zero-config dev). Миграция `0001`.
  Проверено: register → перезапуск API → login работает, объекты/решения/дома/прогресс сохранены.

- **Offline-first для Life Ledger (ADR 0003)**: локальный кэш (чтение офлайн) + очередь мутаций
  (outbox), проигрываемая на сервер через `PUT /objects/:id` (upsert по клиентскому UUIDv7) при
  возврате сети; разрешение конфликтов — **LWW по version**. Индикатор офлайна/очереди в UI,
  авто-синк по событию `online` и периодически. Проверено вживую: создание объекта при
  недоступном сервере → очередь → долив на сервер после восстановления (без дублей).

- **Offline-first для всех модулей (ADR 0003)**: общий движок `offline-core` (единая очередь мутаций,
  авто-синк и индикатор) для всех модулей. Добавлены server-upsert'ы: `PUT /decisions/:id`
  (LWW по version), `PUT /households/:id/tasks/:taskId` (членство + права + LWW), `PUT /content/progress/:id`
  (ключ владелец+playbookKey, LWW по порядку). Клиентские слои `offline-decisions`/`offline-household`/
  `offline-navigator`: чтение из кэша офлайн, создание/правка/тоггл в очередь, слияние несинхронизированных
  записей при обновлении списка (не теряются оптимистичные правки). Проверено вживую: решение, созданное
  офлайн, долилось на сервер с корректным владельцем из JWT. Старые online-only api-файлы удалены.
  API: +6 тестов (upsert decision/household-task/progress).

- **Нативные приложения — desktop и mobile** (одна кодовая база, общий PWA):
  - **Desktop (Tauri, `apps/desktop`)**: Rust-оболочка + WebView2, сборка NSIS `.exe` + WiX `.msi`,
    брендовые иконки. Rust-код полностью компилируется локально; инсталлятор собирает CI (MSVC).
  - **Mobile (Capacitor, `apps/mobile`)**: нативный Android-проект, сборка `.apk` из общего `dist`.
  - **Конфигурируемый адрес API**: `VITE_API_BASE` при сборке + рантайм-переопределение (поле
    «Адрес сервера» на экране входа, `los-api-base`) — для self-hosted бэкенда. Web/PWA без изменений
    (относительный `/api/v1`).
  - **CI релиза** (`release.yml`): на тег `v*` собираются и прикрепляются к GitHub Release
    инсталляторы `.exe`/`.msi` (windows-latest, MSVC) и `.apk` (ubuntu-latest, JDK 17 + Android SDK).

- **Автообновление нативных приложений** (веб уже обновлялся через service worker):
  - **Desktop (Tauri): тихое авто-обновление** из GitHub Releases — проверка `latest.json`, проверка
    подписи (ed25519, публичный ключ в конфиге), скачивание нового `-setup.exe` и перезапуск.
    Плагины `tauri-plugin-updater`/`-process`; артефакты подписываются в CI (секрет
    `TAURI_SIGNING_PRIVATE_KEY`, пароль ключа пустой); генерируется и публикуется `latest.json`.
  - **Android (Capacitor): проверка + установка в один тап** — приложение читает `mobile-update.json`
    и предлагает баннером установить свежий APK (тихая замена пакета без стора Android'ом не разрешена).
  - Клиентский модуль `native-update.ts` (детект Tauri/Capacitor), баннер обновления в `App`.

### Fixed / Security

- **SCA-фиксы** (найдены гейтом и устранены): `multer` → ≥2.2.0 (GHSA-72gw-mp4g-v24j, через
  @nestjs/platform-express, pnpm override); `drizzle-orm` → ^0.45.2 (GHSA-gpj5-g38j-94v9). Аудит чист.

### Notes / остаётся

- Persistence: все модули на PostgreSQL/Drizzle (in-memory без `DATABASE_URL`). Offline-first включён
  для всех модулей (ADR 0003) через `offline-core` + server-upsert'ы с LWW.
- Нативные оболочки: локальная сборка `.exe` под Windows требует MSVC Build Tools (GNU-тулчейн
  спотыкается на embed-resource) — в CI используется MSVC. `.apk` собирается в CI (JDK 17 + Android SDK).
- Дальше по желанию: passkeys/WebAuthn (сейчас TOTP), авто-апдейтеры нативных клиентов (Tauri updater /
  Capacitor OTA), подпись артефактов. AI-слой — опциональный (ADR 0005).

### Security

- Валидация входа Zod на границе API; `.env` вне git; owner-scoped доступ в репозитории (задел под RLS).
