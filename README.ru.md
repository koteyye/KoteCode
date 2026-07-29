```
█  █ █▀▀█ █▀▀█ █▀▀█  █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█▀█  █  █  ██  █▀▀▀  █    █  █ █  █ █▀▀▀
█ ▀█ ▀▀▀▀  ▀▀  ▀▀▀▀  ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
```

[English](README.md) | [Русский](README.ru.md)

# KoteCode

**KoteCode — AI-агент для программирования на базе OpenCode.**

KoteCode — независимый форк [OpenCode](https://github.com/anomalyco/opencode). Проект не связан
с командой OpenCode, не одобрен ею и не является её официальным продуктом. KoteCode развивается
отдельно на основе исходного кода OpenCode под лицензией MIT.

> **Статус:** `v1.0.0` — первая самостоятельная версия KoteCode. Основан на OpenCode `1.18.5`.

## Возможности

KoteCode работает в терминале (TUI) и как десктопное приложение. Он сохраняет основные
возможности OpenCode: работу с разными провайдерами, вызов инструментов, сессии и агентов
`build` и `plan`. Дополнительно форк включает:

- **Kote Proxy** — прозрачный HTTPS `CONNECT`-транспорт для существующих провайдеров;
- отдельные каталоги конфигурации и переменные окружения `KOTECODE_*`;
- команду `kotencode` и собственный бренд KoteCode.

Полный аудит изменений: [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md).

## Важно: стоимость и передача данных

KoteCode отправляет запросы, код и содержимое выбранных файлов тому AI-провайдеру, которого
вы подключили.

- Большинство провайдеров тарифицируют использование моделей по токенам. Сам KoteCode
  бесплатен, но запросы к моделям могут быть платными.
- При включённом Kote Proxy трафик до провайдера остаётся защищён сквозным TLS. Прокси видит
  имя целевого хоста и транспортные метаданные, но не API-ключ, запросы, код и ответы.

## Транспорт провайдеров

OpenAI, Anthropic, OpenRouter и другие провайдеры подключаются обычным способом — через
собственный API-ключ или поддерживаемую провайдером авторизацию. KoteCode и Kote Proxy
не предоставляют кредиты на модели.

```text
KoteCode ── CONNECT через Kote Proxy ── сквозной TLS ── выбранный провайдер
```

Исходный URL провайдера, авторизация, SDK, каталог моделей, потоковая передача, инструменты
и мультимодальность не меняются. Локальные HTTP-провайдеры, например Ollama, работают напрямую.
В Desktop-приложении маршрут выбирается отдельно для каждого провайдера при подключении
и затем меняется в разделе **Настройки → Провайдеры**.

### Получение адреса Kote Proxy

Адрес прокси не зашит в KoteCode. При запуске приложение:

1. загружает небольшую конфигурацию bootstrap с подписью Ed25519;
2. проверяет подпись встроенным публичным ключом;
3. проверяет `config_version`, `issued_at` и `expires_at`;
4. использует подписанный `proxy.url` для HTTPS-запросов к провайдерам.

Формат и процесс подписи описаны в [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md).

Для локальной разработки адрес можно задать вручную:

```bash
KOTECODE_PROXY_URL=https://kote-proxy.kotey-ye.ru kotencode
```

Для явного прямого подключения к провайдерам:

```bash
KOTECODE_DISABLE_PROXY=1 kotencode
```

Если настроенный Kote Proxy недоступен, KoteCode не переключается на прямое соединение скрытно.

## Установка

> Сборки выпускаются черновым release workflow. Сборка из исходников описана в
> [`docs/BUILD.md`](./docs/BUILD.md).

```bash
# Из GitHub Release после публикации
curl -fsSL https://github.com/koteyye/KoteCode/raw/main/install | bash
```

Для сборки из исходников требуется [Bun](https://bun.sh) версии 1.3 или новее:

```bash
git clone https://github.com/koteyye/KoteCode.git
cd KoteCode
bun install
bun run packages/opencode/script/build.ts --single
```

Готовый бинарник появится по пути `dist/kotencode-*/bin/kotencode`.

## Конфигурация

KoteCode хранит настройки отдельно от OpenCode:

| ОС      | Каталог конфигурации                      |
| ------- | ----------------------------------------- |
| Linux   | `~/.config/kotencode`                     |
| macOS   | `~/Library/Application Support/kotencode` |
| Windows | `%APPDATA%\kotencode`                     |

Для миграции существующих настроек:

```bash
kotencode migrate-from-opencode
kotencode migrate-from-opencode --with-secrets
```

Первая команда копирует только несекретные настройки. Вторая также импортирует ключи по явному
запросу. Исходные файлы OpenCode не изменяются.

Основные переменные окружения:

| Переменная                      | Назначение                             |
| ------------------------------- | -------------------------------------- |
| `KOTECODE_CONFIG`               | Путь к файлу конфигурации              |
| `KOTECODE_CONFIG_DIR`           | Другой каталог конфигурации            |
| `KOTECODE_DATA_DIR`             | Другой каталог данных                  |
| `KOTECODE_CACHE_DIR`            | Другой каталог кеша                    |
| `KOTECODE_BOOTSTRAP_URL`        | Другой URL bootstrap для разработки    |
| `KOTECODE_PROXY_URL`            | Принудительный адрес Kote Proxy        |
| `KOTECODE_DISABLE_PROXY`        | Явное прямое подключение к провайдерам |
| `KOTECODE_DISABLE_UPDATE_CHECK` | Отключение проверки обновлений         |
| `KOTECODE_LANG`                 | Язык терминального UI: `ru` или `en`   |

Язык терминального интерфейса по умолчанию — русский. Его можно переключить только между
русским и английским в файле `tui.json` внутри каталога конфигурации:

```json
{
  "language": "ru"
}
```

Для разового запуска на английском:

```bash
KOTECODE_LANG=en kotencode
```

Полное описание: [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md).

## Документация

- [`docs/FORK_AUDIT.md`](./docs/FORK_AUDIT.md) — аудит исходной кодовой базы
- [`docs/UPSTREAM.md`](./docs/UPSTREAM.md) — синхронизация с upstream OpenCode
- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) — формат подписанной bootstrap-конфигурации
- [`docs/NETWORK.md`](./docs/NETWORK.md) — сетевые обращения KoteCode
- [`docs/PROXY_COMPATIBILITY.md`](./docs/PROXY_COMPATIBILITY.md) — совместимость провайдеров
- [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md) — каталоги, переменные и режимы
- [`docs/BUILD.md`](./docs/BUILD.md) — сборка из исходников
- [`docs/TZ-2-KOTE-PROXY.md`](./docs/TZ-2-KOTE-PROXY.md) — контракт и модель угроз Kote Proxy

## Лицензия

MIT — см. [`LICENSE`](./LICENSE). KoteCode основан на OpenCode (© 2025 opencode, MIT);
атрибуция приведена в [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
