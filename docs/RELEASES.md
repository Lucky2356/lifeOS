# Life OS — Релизы и автообновление

## Версионирование

SemVer, теги вида `vX.Y.Z`. Версия сборки прокидывается в клиент (`APP_VERSION`) и видна в
«Настройки → ИИ и приватность» внизу, а также в `/(<web>)/version.json`.

## Как выпустить релиз

1. Обновить `CHANGELOG.md`.
2. Поставить тег и запушить:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. Workflow `.github/workflows/release.yml` автоматически:
   - собирает web с версией = тег, пакует `life-os-web-<tag>.zip`;
   - создаёт **GitHub Release** с авто-нотами;
   - собирает **десктоп-инсталляторы** (Tauri, Windows): `Life OS_<tag>_x64-setup.exe` (NSIS)
     и `Life OS_<tag>_x64_en-US.msi` — прикрепляются к релизу;
   - собирает **Android-приложение** (Capacitor): `life-os-<tag>.apk` — прикрепляется к релизу;
   - собирает и пушит **Docker-образы** в GHCR:
     `ghcr.io/<repo>-api:<tag>` и `-web:<tag>` (+ `:latest`).

   Итог: на странице релиза лежат `.exe`/`.msi` (ПК), `.apk` (Android), `.zip` (web) и ссылки на образы.

## Автообновление по платформам

### Web — обновляется сразу

Service worker версионирует кэш по build-id (`life-os-<version>`). При новом релизе:
новый SW устанавливается, берёт управление (`skipWaiting` + `clients.claim`), клиент ловит
`controllerchange` и **перезагружается автоматически**. Дополнительно приложение периодически
(`reg.update()` раз в минуту и при фокусе вкладки) проверяет наличие новой версии — открытая
вкладка подхватит релиз без действий пользователя.

### Установленный PWA (телефон и ПК) — тот же механизм

Life OS устанавливается как PWA на Android/iOS и на десктоп (Chrome/Edge «Установить приложение»).
Обновление приходит тем же service worker'ом: при следующем открытии/фокусе приложение проверит
версию и мгновенно обновится. Отдельная публикация в сторы не требуется.

### Нативные оболочки — устройство и сборка

Обе оболочки грузят **один и тот же PWA** (`apps/web/dist`) — вся логика в веб-слое, оболочки дают
нативное окно/пакет и системную интеграцию. Общий домен и UI не дублируются.

- **Desktop — Tauri** (`apps/desktop`): Rust-оболочка + системный WebView2. `pnpm --filter @life-os/desktop
exec tauri build` собирает NSIS `.exe` и WiX `.msi`. Локально под Windows нужен MSVC Build Tools
  (или GNU-тулчейн + mingw); в CI используется MSVC на `windows-latest`.
- **Mobile — Capacitor** (`apps/mobile`): нативный Android-проект в `apps/mobile/android`. Сборка:
  `pnpm --filter @life-os/web build` → `cap sync android` → `./gradlew assembleDebug` → `app-debug.apk`.
  Требуется JDK 17 + Android SDK (в CI — `ubuntu-latest`, SDK предустановлен).

**Адрес API в нативных оболочках.** У native-клиента нет общего origin с бэкендом, поэтому адрес
сервера задаётся при сборке через `VITE_API_BASE` и **переопределяется в рантайме** — поле
«Адрес сервера» на экране входа (сохраняется в `los-api-base`). Значения по умолчанию: desktop —
`http://localhost:3011/api/v1`, Android-эмулятор — `http://10.0.2.2:3011/api/v1`.

### Автообновление нативных — реализовано

- **Tauri (ПК): тихое авто-обновление.** Приложение при запуске обращается к
  `releases/latest/download/latest.json`, проверяет подпись (публичный ключ вшит в `tauri.conf.json`),
  скачивает новый подписанный `-setup.exe` и перезапускается. Никаких действий пользователя.
  - **Разовая настройка:** приватный ключ подписи лежит в секрете репозитория `TAURI_SIGNING_PRIVATE_KEY`
    (пароль ключа пустой). Ключ сгенерирован `tauri signer generate`; **публичный** ключ — в конфиге,
    приватный — только в секретах и в `apps/desktop/lifeos-updater.key` (в `.gitignore`, не коммитится).
    Установить секрет: `gh secret set TAURI_SIGNING_PRIVATE_KEY < apps/desktop/lifeos-updater.key`.
  - CI на каждый тег собирает подписанный установщик, его `.sig` и `latest.json` — всё в релиз.
- **Android (Capacitor, sideload): проверка + установка в один тап.** На старте приложение читает
  `releases/latest/download/mobile-update.json`; если версия новее — показывает ненавязчивый баннер
  «Доступна новая версия», кнопка открывает загрузку свежего APK (Android ставит его после подтверждения).
  Тихая замена всего пакета без стора Android'ом не разрешена; данные при обновлении сохраняются
  (локальный кэш + сервер). Полностью тихий вариант — OTA веб-слоя (Capgo) — возможен как следующий шаг.

## Развёртывание сервера из релиза

```bash
# по тегу
docker pull ghcr.io/<repo>-api:v0.1.0
docker pull ghcr.io/<repo>-web:v0.1.0
# или полный стек
docker compose -f infra/docker/docker-compose.prod.yml up -d
```
