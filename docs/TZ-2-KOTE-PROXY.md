# KoteCode — ТЗ №2: Kote Proxy

Статус: черновик для согласования  
Дата: 2026-07-28  
Совместимый клиент на момент составления: KoteCode, commit `9f4bc6e4f7`

## 1. Цель

Kote Proxy — бесплатный сетевой transport для пользователей KoteCode.

Пользователь по-прежнему подключает существующего провайдера OpenCode обычным
способом:

- вводит собственный API key OpenAI, Anthropic, OpenRouter или другого провайдера;
- либо проходит штатную авторизацию/OAuth, если её поддерживает OpenCode;
- самостоятельно оплачивает использование модели по правилам провайдера.

KoteCode использует существующий provider layer и существующий AI SDK. Единственное
изменение: HTTPS-запрос к API провайдера проходит через Kote Proxy.

Kote Proxy:

- не предоставляет доступ к LLM за счёт владельца KoteCode;
- не содержит общего OpenAI/OpenRouter/Anthropic key;
- не подменяет выбранного пользователем провайдера;
- не реализует повторно API провайдеров;
- не выполняет tools;
- не хранит чаты.

## 2. Зафиксированная архитектура

Используется стандартный HTTPS forward proxy с методом `CONNECT`.

```text
KoteCode
  │
  │ CONNECT api.openai.com:443
  ▼
Kote Proxy
  │
  │ непрозрачный TCP tunnel
  ▼
api.openai.com:443

Внутри tunnel:
KoteCode ───── TLS напрямую до api.openai.com ───── OpenAI
```

Последовательность:

1. KoteCode подключается к Kote Proxy по HTTPS.
2. KoteCode отправляет `CONNECT <provider-host>:443`.
3. Proxy проверяет host и port по allowlist.
4. Proxy открывает TCP-соединение до разрешённого провайдера.
5. KoteCode устанавливает внутренний TLS-сеанс непосредственно с провайдером.
6. Proxy пересылает зашифрованные байты в обе стороны.

Благодаря внутреннему TLS:

- API key и OAuth bearer token видит только KoteCode и целевой провайдер;
- Proxy не видит URL path, query, headers, prompt, tool arguments и response;
- TLS-сертификат целевого провайдера проверяет сам KoteCode;
- исходный host и URL провайдера не меняются;
- provider-specific подписи и протоколы не нужно реализовывать на Proxy.

## 3. Почему не нужен отдельный LLM-провайдер

Kote Proxy является transport layer, а не provider.

В KoteCode уже существуют:

- каталог моделей;
- OpenAI, Anthropic, OpenRouter и другие provider adapters;
- API-key auth;
- OAuth/авторизация;
- streaming;
- tool calling;
- reasoning;
- multimodal;
- обработка provider-specific ошибок.

Все эти механизмы продолжают работать штатно. В общий `fetch`, который использует
выбранный provider SDK, добавляется proxy URL.

Следовательно, Kote Proxy не нужны:

- `POST /chat/completions`;
- `GET /models`;
- преобразование форматов разных провайдеров;
- model registry;
- upstream LLM key;
- пользовательские ключи самого Gateway;
- маршрутизация public model ID;
- собственная логика reasoning/tools/multimodal.

## 4. Что именно проксируется

Через Kote Proxy проходят только runtime-запросы provider SDK к моделям:

- генерация ответа;
- streaming;
- следующие provider turns после tool calls;
- provider-side model API, если конкретный SDK вызывает его во время работы;
- refresh-запрос, если он выполняется тем же внедрённым provider transport.

По умолчанию через Kote Proxy не проходят:

- загрузка bootstrap;
- `models.dev`;
- GitHub Releases;
- npm;
- MCP;
- session sharing;
- telemetry;
- произвольные plugin-запросы;
- локальные и `localhost`-endpoint;
- OAuth-страница в браузере.

Получение OAuth token может оставаться штатным прямым flow OpenCode. После получения
bearer token модельный HTTPS-запрос идёт через CONNECT tunnel.

Если потребуется проксировать и OAuth token exchange, это добавляется отдельно для
конкретного provider после security-review.

## 5. Свойства безопасности

### 5.1 End-to-end TLS

Proxy не выполняет TLS interception и не выпускает поддельные сертификаты.

Запрещено:

- устанавливать собственный CA в KoteCode или ОС;
- расшифровывать provider traffic;
- модифицировать HTTP headers/body внутри tunnel;
- сохранять передаваемые байты;
- отключать проверку TLS-сертификата провайдера.

Успешная атака или компрометация Proxy не должна сама по себе позволять прочитать
API key или prompt. Без компрометации KoteCode, provider или TLS это остаётся
зашифрованным содержимым tunnel.

### 5.2 Не открытый proxy

Kote Proxy доступен бесплатно и не требует аккаунта, но не должен быть универсальным
public proxy.

Разрешается только:

- метод `CONNECT`;
- целевой port `443`;
- host из server-side allowlist AI-провайдеров.

Запрещается:

- произвольный host;
- IP literal;
- private, loopback, link-local и reserved IP;
- другие ports;
- plain HTTP forwarding;
- UDP;
- SOCKS;
- CONNECT к самому Proxy;
- CONNECT к metadata endpoint облачной инфраструктуры.

Проверка выполняется до открытия target-соединения и повторяется для результата DNS.

### 5.3 Что Proxy всё равно видит

Владелец Proxy технически видит только transport metadata:

- IP пользователя;
- целевой hostname и port из `CONNECT`;
- время подключения;
- длительность;
- объём переданных байт;
- transport error.

Proxy не видит provider URL path, API key, OAuth token, prompt и response. Это
должно быть прямо описано в пользовательской документации KoteCode.

## 6. Allowlist провайдеров

Allowlist хранится на сервере без секретов:

```yaml
hosts:
  - api.openai.com
  - api.anthropic.com
  - openrouter.ai
  - generativelanguage.googleapis.com
```

Требования:

- exact hostname предпочтительнее wildcard;
- wildcard допускается только для документированных provider-owned зон;
- правило suffix не должно принимать сам suffix и чужие look-alike domains;
- internationalized hostname нормализуется до ASCII/Punycode;
- hostname сравнивается без учёта регистра и завершающей точки;
- после DNS resolution запрещаются private/reserved адреса;
- redirect внутри внутреннего HTTPS недоступен Proxy и обрабатывается provider SDK;
- изменение allowlist не требует выпуска KoteCode.

Для Azure, Google Vertex, Amazon Bedrock и других динамических host требуется
отдельное безопасное правило и интеграционный тест.

Custom provider URL пользователя по умолчанию не проксируется. Он работает напрямую
либо требует явного добавления домена владельцем Proxy.

## 7. Серверный протокол

### 7.1 `CONNECT`

Пример запроса:

```http
CONNECT api.openai.com:443 HTTP/1.1
Host: api.openai.com:443
```

Успех:

```http
HTTP/1.1 200 Connection Established
```

После `200` Proxy переключается в full-duplex byte tunnel.

Ошибки до tunnel:

| HTTP  | Причина                                                       |
| ----- | ------------------------------------------------------------- |
| `400` | Некорректный authority/host/port                              |
| `403` | Host или port отсутствует в allowlist                         |
| `405` | Метод, отличный от разрешённых служебных endpoint и `CONNECT` |
| `429` | Превышен rate/concurrency limit                               |
| `502` | Не удалось подключиться к разрешённому target                 |
| `504` | Target connect timeout                                        |

После установления tunnel HTTP-ошибки отправить нельзя: соединение корректно
закрывается, а transport error фиксируется в безопасном логе.

### 7.2 `GET /health`

Служебный HTTPS endpoint:

```json
{
  "status": "ok"
}
```

`200` означает, что конфигурация и allowlist загружены. Health check не подключается
к LLM provider и не раскрывает allowlist.

Другие обычные HTTP methods и paths возвращают `405` или `404`.

## 8. Работа tunnel

Proxy обязан:

- поддерживать full-duplex передачу;
- не буферизовать весь поток;
- корректно передавать backpressure;
- поддерживать долгие SSE-соединения внутри TLS;
- закрывать вторую сторону при disconnect;
- поддерживать half-close, если runtime это позволяет;
- иметь target connect timeout;
- иметь большой, но конечный idle timeout;
- иметь максимальную длительность tunnel;
- ограничивать количество одновременных tunnel;
- освобождать ресурсы при shutdown.

Черновые значения alpha:

| Лимит                     |  Значение |
| ------------------------- | --------: |
| Target connect timeout    | 10 секунд |
| Idle tunnel timeout       |   5 минут |
| Maximum tunnel duration   |  30 минут |
| Concurrent tunnels/IP     |         4 |
| New tunnels/IP/minute     |        30 |
| Global concurrent tunnels |       200 |

Значения конфигурируемые и уточняются нагрузочным тестом.

## 9. Аутентификация

### 9.1 Провайдер

Пользовательская авторизация провайдера остаётся штатной:

- OpenAI API key;
- Anthropic API key;
- OpenRouter API key;
- OAuth bearer token;
- provider-specific credentials и подписи.

Эти данные находятся внутри end-to-end TLS и не обрабатываются Kote Proxy.

### 9.2 Kote Proxy

В alpha Kote Proxy бесплатен и не требует отдельного proxy key.

Статический секрет нельзя вшивать в KoteCode: он будет извлечён и не обеспечит
ограничение только официальным клиентом.

Если позже потребуется идентификация пользователей Proxy, она проектируется
отдельно. `Proxy-Authorization` поддерживается Bun, но способ безопасной выдачи
персональных proxy credentials не входит в это ТЗ.

## 10. Защита от abuse

Поскольку LLM оплачивает сам пользователь, Proxy не несёт token cost, но должен быть
защищён от расхода bandwidth, file descriptors и использования как relay.

Минимальные меры:

- жёсткий host/port allowlist;
- запрет IP literals и private/reserved target;
- per-IP connection rate limit;
- per-IP concurrency limit;
- global concurrency limit;
- connect/idle/total timeout;
- ограничение bytes per tunnel и/или bandwidth при необходимости;
- защита от медленной отправки CONNECT headers;
- максимальный размер request headers;
- аварийный выключатель новых tunnel;
- возможность мгновенно удалить host из allowlist.

IP limits не являются идентификацией и могут обходиться VPN. Их задача — защита
ресурсов Proxy, а не ограничение доступа к LLM.

## 11. Логи и приватность

Разрешённый структурный лог:

- timestamp;
- request ID;
- client IP с политикой retention;
- target hostname и port;
- allow/deny;
- duration;
- bytes client-to-target и target-to-client;
- transport status/error;
- limit reason.

Запрещено:

- сохранять tunnel payload;
- packet capture в production;
- TLS interception;
- provider API key/OAuth token;
- provider URL path/query;
- prompts, tools, attachments и responses;
- вывод полного `Proxy-Authorization`, если он появится в будущем.

Метрики не должны использовать IP или request ID как label.

## 12. Bootstrap

Текущий gateway bootstrap ТЗ №1 должен быть заменён на proxy bootstrap:

```json
{
  "config_version": 1,
  "proxy": {
    "url": "https://kote-proxy.kotey-ye.ru"
  },
  "issued_at": "2026-07-28T00:00:00.000Z",
  "expires_at": "2026-08-27T00:00:00.000Z",
  "signature": "<Ed25519 signature>"
}
```

Сохраняются уже реализованные свойства:

- Ed25519 verification;
- HTTPS;
- timeout и size limit;
- запрет redirect;
- fresh remote config;
- last-known-good cache;
- семидневный emergency grace period;
- private signing key вне репозитория, CI и runtime.

Переменные клиента:

- `KOTECODE_BOOTSTRAP_URL` — override bootstrap;
- `KOTECODE_PROXY_URL` — явный proxy URL для dev/диагностики;
- `KOTECODE_DISABLE_PROXY=1` — явный direct mode.

`KOTECODE_GATEWAY_URL` и `KOTECODE_GATEWAY_API_KEY` не соответствуют уточнённой
архитектуре и до первого релиза удаляются либо помечаются как устаревшие aliases.

## 13. Поведение KoteCode

### 13.1 Режим по умолчанию

KoteCode получает подписанный proxy URL и применяет его только к provider runtime
requests.

Для каждого provider fetch:

```ts
fetch(providerUrl, {
  ...providerOptions,
  proxy: resolvedProxyUrl,
})
```

Bun `1.3.14` поддерживает `BunFetchRequestInit.proxy` и использует переданные proxy
headers в `CONNECT` для HTTPS target.

### 13.2 Существующий custom fetch

KoteCode уже оборачивает provider `fetch` в `resolveSDK`. Proxy option добавляется в
эту внешнюю обёртку и передаётся в существующий custom fetch:

- provider auth/transformation выполняется как раньше;
- custom fetch сохраняет `init.proxy`;
- финальный Bun `fetch` открывает CONNECT tunnel;
- timeout/cancellation wrapper KoteCode продолжает работать.

Providers, которые игнорируют injected `fetch` или используют собственный socket
transport, считаются неподдержанными до отдельной адаптации.

### 13.3 Ошибки и fallback

Если подписанный Proxy включён, но недоступен:

- provider request завершается понятной transport-ошибкой;
- KoteCode не переключается на direct mode молча;
- API key не отправляется по неожиданному маршруту;
- пользователь может явно включить direct mode через настройку/env.

Невалидный bootstrap также не включает silent direct fallback.

### 13.4 Прозрачность

В диагностике KoteCode показывает:

- `proxy: remote bootstrap | cached bootstrap | environment | disabled`;
- proxy hostname без credentials;
- выбранный provider и его исходный hostname;
- способ явно отключить Proxy.

CLI-интерфейс диагностики:

```bash
kotencode debug proxy
kotencode debug proxy --model openai/gpt-5
```

## 14. Изменения клиентской части KoteCode

Текущая реализация на commit `9f4bc6e4f7` построена как отдельный
OpenAI-compatible provider `kote-gateway`. После уточнения это неверная точка
интеграции.

В этой ветке выполнено:

1. удалён `discoverKoteGatewayModels`;
2. удалён custom provider `kote-gateway`;
3. удалена его отдельная модельная discovery/auth-логика;
4. убрана специальная обработка `KOTECODE_GATEWAY_API_KEY`;
5. bootstrap schema заменена с `gateway.base_url/models_url` на `proxy.url`;
6. runtime env переименован в `KOTECODE_PROXY_URL`;
7. добавлен `KOTECODE_DISABLE_PROXY`;
8. `proxy` внедрён в общий provider fetch wrapper и native LLM runtime;
9. bootstrap и непровайдерские запросы не проксируются;
10. добавлена CLI-диагностика source/endpoint;
11. обновлены README, `BOOTSTRAP.md`, `NETWORK.md` и `CONFIGURATION.md`;
12. gateway provider tests заменены на proxy transport tests.

Штатные OpenAI/OpenRouter/Anthropic provider и auth-механизмы не переписываются.

## 15. Совместимость провайдеров

### Группа A — ожидается прозрачная работа

- HTTPS provider с API key в header;
- HTTPS provider с OAuth bearer token;
- OpenAI-compatible API;
- Anthropic Messages API;
- streaming/SSE;
- tool calls/reasoning/multimodal внутри HTTPS;
- request signing, если SDK сохраняет исходный URL/host и использует injected
  transport.

### Группа B — требует отдельной проверки

- SDK, который игнорирует injected `fetch`;
- WebSocket transport;
- gRPC/HTTP2-specific transport;
- динамические Azure/Vertex/Bedrock host;
- mutual TLS;
- custom enterprise endpoint;
- provider, обращающийся к нескольким дополнительным доменам.

Непроверенный provider не должен считаться поддержанным только потому, что он есть в
OpenCode. Для первой alpha публикуется явная compatibility matrix.

Текущий статус клиентских путей и обязательные smoke tests зафиксированы в
[`PROXY_COMPATIBILITY.md`](./PROXY_COMPATIBILITY.md).

## 16. Тестирование Proxy

### 16.1 Unit

- authority parser;
- hostname normalization;
- exact/suffix allowlist;
- port restriction;
- IP literal rejection;
- private/reserved DNS rejection;
- timeouts и limits;
- безопасные log fields.

### 16.2 Integration

Локальный тест поднимает:

1. HTTPS target с тестовым сертификатом;
2. Kote Proxy;
3. Bun fetch с `proxy`;
4. streaming response.

Проверяется:

- Proxy получает `CONNECT target:443`;
- target получает исходный path, query, headers и body;
- API key доходит target;
- Proxy payload capture не содержит marker API key/prompt;
- сертификат target проверяется клиентом;
- неверный сертификат отклоняется;
- SSE не буферизуется;
- abort клиента закрывает target connection;
- запрещённый host/port не получает соединение;
- rate/concurrency limits освобождаются после disconnect.

### 16.3 KoteCode provider matrix

Минимум:

- OpenAI с API key;
- Anthropic с API key;
- OpenRouter с API key;
- один OAuth/bearer provider;
- tool call round-trip;
- reasoning stream;
- image attachment для поддерживаемой модели;
- direct mode;
- Proxy unavailable без silent fallback.

CI использует fake providers и не требует реальных ключей. Реальные smoke-тесты
запускаются вручную с минимальными лимитами.

## 17. Нефункциональные требования

- Linux container или standalone binary;
- graceful shutdown;
- отсутствие root в container;
- read-only filesystem, если runtime позволяет;
- отсутствие request-body buffering;
- поддержка IPv4 и IPv6 с одинаковыми ACL;
- dependency/secret scan в CI;
- нагрузочный тест долгих tunnel;
- документированный rollback;
- конфигурация allowlist без пересборки image.

Обычный reverse proxy/CDN перед сервисом должен явно поддерживать `CONNECT`.
Нельзя предполагать, что стандартный HTTP reverse proxy или CDN пропустит tunnel.
Предпочтителен прямой TLS endpoint сервиса либо L4 ingress.

## 18. Рекомендуемый стек

Контракт не зависит от языка. Для небольшого надёжного CONNECT proxy рекомендуется:

- Go;
- стандартные `net/http`, `net`, `tls`;
- минимальное число зависимостей;
- Docker/OCI;
- GitHub Actions.

Причина выбора Go — простой full-duplex TCP tunnel, предсказуемая отмена и отсутствие
необходимости реализовывать LLM-протоколы.

Допустим готовый проверенный proxy engine с собственной тонкой конфигурацией, если
он обеспечивает все ACL, privacy и test requirements.

## 19. Этапы реализации

### Этап A — Proxy

- HTTP/HTTPS server;
- CONNECT tunnel;
- host/port/DNS ACL;
- timeouts и limits;
- health;
- safe logging;
- tests;
- container и CI.

### Этап B — KoteCode transport

- новый bootstrap schema;
- proxy resolver/cache;
- общий provider fetch wrapper;
- direct-mode switch;
- diagnostics;
- provider compatibility tests;
- удаление отдельного `kote-gateway`.

### Этап C — alpha

- production allowlist;
- deployment без несовместимого CDN;
- end-to-end smoke;
- публикация подписанного bootstrap;
- compatibility matrix;
- обновление network/privacy docs;
- alpha release.

## 20. Критерии приёмки

| ID   | Проверка         | Результат                                                  |
| ---- | ---------------- | ---------------------------------------------------------- |
| A-01 | OpenAI API key   | Штатный OpenAI provider работает через Proxy               |
| A-02 | OAuth bearer     | Штатный provider работает без новой авторизации            |
| A-03 | TLS privacy      | Proxy не видит marker key/prompt/response                  |
| A-04 | TLS validation   | Поддельный target certificate отклоняется KoteCode         |
| A-05 | Streaming        | SSE/tool/reasoning stream не буферизуется                  |
| A-06 | Original host    | Provider получает исходный Host/path/query                 |
| A-07 | Allowlist        | Произвольный сайт/IP/port недоступен                       |
| A-08 | Disconnect       | Отмена KoteCode закрывает обе стороны tunnel               |
| A-09 | Direct mode      | Явное отключение Proxy возвращает штатный direct transport |
| A-10 | No fallback      | Недоступный Proxy не вызывает silent direct request        |
| A-11 | No provider fork | OpenCode provider/auth logic не продублирован на сервере   |
| A-12 | Bootstrap        | Подписанный proxy URL проходит remote/cache/grace flow     |
| A-13 | Logs             | В логах только transport metadata                          |
| A-14 | Compatibility    | Опубликована матрица проверенных providers                 |

## 21. Решения, требующие подтверждения

1. Proxy включён по умолчанию или пользователь включает его явно?
2. Разрешён ли пользователю direct mode?
3. Какие providers входят в первую alpha allowlist?
4. Нужно ли проксировать OAuth token exchange или только model runtime traffic?
5. Где размещается TLS endpoint, поддерживающий `CONNECT`?
6. Какой срок хранения client IP в transport logs?
7. Требуется ли bandwidth cap на tunnel?
8. URL нового репозитория Kote Proxy.

Эти решения не меняют основную модель: пользовательские credentials и выбранный
provider остаются штатными, а Kote Proxy является только непрозрачным HTTPS
transport.
