# Life OS — релизы, подпись и автообновление

Приложение локальное ([ADR 0006](adr/0006-local-only.md)), поэтому релиз — это два установщика и
ничего больше: серверных образов и веб-архива нет.

## Что выходит в релизе

| Файл                                             | Платформа                                      |
| ------------------------------------------------ | ---------------------------------------------- |
| `Life OS_<version>_x64-setup.exe` (+ `.exe.sig`) | Windows, NSIS-установщик, умеет автообновление |
| `Life OS_<version>_x64_en-US.msi`                | Windows, MSI                                   |
| `latest.json`                                    | манифест автообновления для Tauri              |
| `life-os-<tag>.apk`                              | Android, подписан релизным ключом              |
| `mobile-update.json`                             | манифест проверки обновлений для Android       |

## Версионирование

SemVer, теги `vX.Y.Z`. Версия проставляется во все места одной командой — раньше они расходились:

```bash
node scripts/set-version.mjs 1.0.0
```

Скрипт правит `package.json` (корень и все пакеты), `Cargo.toml` и `Cargo.lock` десктопа,
`tauri.conf.json`, а также `versionName`/`versionCode` Android. `versionCode` выводится из semver
(`major*10000 + minor*100 + patch`) — Android требует, чтобы код каждого обновления был больше
предыдущего.

## Как выпустить релиз

Путей два, оба ведут в один и тот же `.github/workflows/release.yml`: он создаёт релиз, собирает
установщик Windows (подписывая артефакты апдейтера) и релизный APK, проверяет подпись APK и
прикрепляет всё к релизу вместе с манифестами обновления.

### Из браузера — ничего локально не нужно

**Actions** → **Release** → **Run workflow** → версия (`1.5.0`, без `v`) → **Run workflow**.

Workflow сам прогонит гейты, проставит версию во все файлы, закоммитит, поставит тег и соберёт
установщики. Гейты здесь обязательны: с машины их запускают руками, а «в один клик» проще всего
выпустить именно сломанное.

Галочка **«Только проверка»** (dry run) прогоняет проверки и останавливается — ничего не коммитит,
не тегает и не выпускает.

`CHANGELOG.md` workflow не пишет: если раздела для версии нет, он предупредит в сводке, а заметки к
релизу соберутся из коммитов. Раздел удобно добавить заранее через веб-редактор GitHub.

### С машины

1. `node scripts/set-version.mjs X.Y.Z`
2. Обновить `CHANGELOG.md`.
3. Прогнать гейты локально: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm validate:content`
4. Закоммитить, поставить тег и запушить:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

## Разовая настройка: ключ подписи Android

Без этого ключа релизный APK собрать нечем, и workflow специально падает с понятной ошибкой —
неподписанная или debug-подписанная сборка не должна попадать в релиз.

1. Создайте ключ. Пароль keytool спросит сам — не передавайте его флагом, иначе он осядет в
   истории оболочки. Хранить ключ нужно **надёжно и навсегда**: потеряете — не сможете выпускать
   обновления поверх уже установленного приложения.

   Windows (PowerShell). `keytool` входит в состав JDK и обычно не прописан в PATH; проще всего
   взять его из JDK, который ставится вместе с Android Studio:

   ```powershell
   & "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore life-os-release.jks -alias life-os -keyalg RSA -keysize 4096 -validity 10000
   ```

   Linux/macOS (если JDK в PATH):

   ```bash
   keytool -genkeypair -v -keystore life-os-release.jks -alias life-os -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Переведите файл в base64.

   Windows (PowerShell) — у `base64` из GNU coreutils нет аналога в PowerShell:

   ```powershell
   [IO.File]::WriteAllText("life-os-release.jks.b64", [Convert]::ToBase64String([IO.File]::ReadAllBytes("life-os-release.jks")))
   ```

   Linux/macOS:

   ```bash
   base64 -w0 life-os-release.jks > life-os-release.jks.b64
   ```

3. Добавьте четыре секрета в настройках репозитория (Settings → Secrets and variables → Actions):

   | Секрет                      | Значение                             |
   | --------------------------- | ------------------------------------ |
   | `ANDROID_KEYSTORE_BASE64`   | содержимое `life-os-release.jks.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища из шага 1           |
   | `ANDROID_KEY_ALIAS`         | `life-os`                            |
   | `ANDROID_KEY_PASSWORD`      | пароль ключа из шага 1               |

   Через `gh` файл с ключом не придётся открывать вручную, а пароли будут запрошены скрытым вводом:

   ```powershell
   Get-Content life-os-release.jks.b64 | gh secret set ANDROID_KEYSTORE_BASE64
   gh secret set ANDROID_KEYSTORE_PASSWORD
   gh secret set ANDROID_KEY_ALIAS --body "life-os"
   gh secret set ANDROID_KEY_PASSWORD
   ```

4. Файл `.jks` и его base64 не коммитьте. Храните копию ключа отдельно от репозитория — прочитать
   секрет из GitHub назад нельзя, а без исходного ключа обновления перестанут ставиться поверх
   установленного приложения (см. [MOVING.md](MOVING.md)).

> **Первая установка после 1.0.** До 1.0 в релиз уходил debug-подписанный APK. Android не разрешает
> обновление поверх приложения с другой подписью — старую версию нужно сначала удалить.

## Разовая настройка: ключ подписи обновлений десктопа

Приватный ключ minisign лежит в секрете `TAURI_SIGNING_PRIVATE_KEY` (пароль пустой), публичный вшит
в `apps/desktop/src-tauri/tauri.conf.json`. Ключ создан через `tauri signer generate`; файл
`apps/desktop/lifeos-updater.key` в `.gitignore`. Установка секрета:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < apps/desktop/lifeos-updater.key
```

## Автообновление

- **Windows — тихо.** При запуске приложение читает
  `releases/latest/download/latest.json`, проверяет подпись публичным ключом, скачивает новый
  установщик и перезапускается. Данные в IndexedDB при обновлении сохраняются.
- **Android — в один тап.** При запуске читается
  `releases/latest/download/mobile-update.json`; если версия новее, показывается баннер, кнопка
  открывает загрузку APK. Тихая замена пакета без стора в Android невозможна. Данные сохраняются,
  пока подпись APK та же.

Это единственные сетевые обращения приложения — данные пользователя в них не участвуют.

## Локальная сборка

```bash
# Windows: нужен MSVC Build Tools
pnpm --filter @life-os/domain build
pnpm --filter @life-os/desktop exec tauri build

# Android: нужен JDK 17 + Android SDK
pnpm --filter @life-os/domain build
pnpm --filter @life-os/app build
pnpm --filter @life-os/mobile exec cap sync android
cd apps/mobile/android && ./gradlew assembleRelease
```

Без переменной `ANDROID_KEYSTORE_PATH` градл соберёт неподписанный релиз — это годится для проверки
сборки, но не для распространения.

## Чего в релизах больше нет

Веб-архива (`life-os-web-*.zip`), Docker-образов в GHCR и развёртывания сервера: серверной части
не существует начиная с 1.0.
