# CaaS Cards API — руководство для разработчиков

API для выпуска и обслуживания виртуальных платёжных карт: создание держателей, эмиссия карт, пополнение и вывод средств, заморозка/закрытие, получение реквизитов, тарифы и вебхуки.

- **Базовый URL:** `https://api.2328.io/caas/v1`
- **Версия:** v1. Обратно-совместимые изменения (новые поля ответа, новые `error.code`, новые типы событий) выкатываются без смены версии — клиент **обязан игнорировать незнакомые поля** и предусматривать ветку по умолчанию для незнакомых кодов/статусов.
- **Формат:** только JSON, `Content-Type: application/json`. Все поля — `camelCase`.

> Машиночитаемый контракт — `openapi.yaml` (OpenAPI 3.1). Этот документ — практическое руководство поверх него.

---

## Оглавление

- [Быстрый старт](#быстрый-старт)
- [Аутентификация](#аутентификация)
- [Права доступа (scopes)](#права-доступа-scopes)
- [Соглашения](#соглашения)
- [Аккаунт](#аккаунт)
- [Тарифы](#тарифы)
- [Держатели карт (Cardholders)](#держатели-карт-cardholders)
- [Карты — выпуск и обслуживание](#карты--выпуск-и-обслуживание)
- [Карты — деньги, заморозка, реквизиты](#карты--деньги-заморозка-реквизиты)
- [Продукты](#продукты)
- [Заказы (Orders)](#заказы-orders)
- [Вебхуки — конфигурация и доставки](#вебхуки--конфигурация-и-доставки)
- [Вебхуки: приём событий](#вебхуки-приём-событий)
- [Справочник кодов ошибок](#справочник-кодов-ошибок)
- [Справочник статусов и enum](#справочник-статусов-и-enum)

---

## Быстрый старт

```bash
# 1. Проверка доступности (без авторизации)
curl https://api.2328.io/caas/v1/ping

# 2. Параметры и возможности аккаунта
curl https://api.2328.io/caas/v1/account/info \
  -H "Authorization: Bearer ck_ВАШ_КЛЮЧ"

# 3. Баланс кошелька (USDT)
curl https://api.2328.io/caas/v1/account/wallet \
  -H "Authorization: Bearer ck_ВАШ_КЛЮЧ"
```

Типовой сценарий интеграции:

1. Создать держателя — `POST /cardholders`.
2. Выбрать продукт из каталога — `GET /cards/products`.
3. Выпустить карту — `POST /cards` → получить `orderId` (асинхронно).
4. Дождаться исхода — `GET /orders/{orderId}` или вебхук `card.created`.
5. Далее — пополнение (`fund`), вывод (`unload`), заморозка, реквизиты, транзакции.

---

## Аутентификация

Каждый запрос (кроме `GET /ping`) требует заголовок:

```
Authorization: Bearer ck_{keyId}_{secret}
```

Ключ выдаётся при онбординге и в личном кабинете. **Секрет показывается один раз** — сохраните его сразу; восстановить нельзя, только выпустить новый ключ. Ключ определяет ваш аккаунт (тенант) — все данные автоматически ограничены им, никаких `merchant_id`/`account_id` в запросах передавать не нужно.

- Нет/битый/просроченный/отозванный ключ → **`401 auth.unauthorized`**.
- Ключу не хватает права (scope) → **`403 auth.scope_denied`** (в `error.details.requiredScope` — какого именно).
- Обращение к чужому/несуществующему ресурсу → **`404`** (изоляция аккаунтов; чужой объект неотличим от несуществующего).

Продукт работает в **едином боевом окружении**: `GET /account/info` → `data.environment` всегда возвращает `live`. Отдельных тестовых ключей и песочницы нет.

## Права доступа (scopes)

Ключу выдаётся набор прав. Каждый эндпоинт требует конкретный scope (указан в его описании).

| Scope | Доступ |
|---|---|
| `account:read` | аккаунт, возможности (capabilities), баланс кошелька, прайслист |
| `account:write` | операции записи уровня аккаунта (в текущем релизе — только устаревший `POST /account/deposit-address`, всегда `422`) |
| `transactions:read` | движения кошелька и транзакции карты |
| `tariffs:read` | тарифные планы и расчёт стоимости |
| `cardholders:read` / `cardholders:write` | чтение / создание держателей |
| `cards:read` / `cards:write` | чтение / выпуск и операции с картами |
| `cards:secure:read` | реквизиты карты (PAN/CVV) — отдельное право, требует включённого secure-режима |
| `webhooks:read` / `webhooks:write` | чтение / изменение конфигурации вебхуков |

---

## Соглашения

### Конверт ответа

Все ответы завёрнуты в единый конверт.

**Успех:**

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "...": "полезная нагрузка эндпоинта" },
  "meta": {
    "requestId": "req_01J9X2K7M3QF8YV4N0P6T1ABCR",
    "timestamp": "2026-07-01T12:00:00Z"
  }
}
```

**Ошибка:**

```json
{
  "success": false,
  "status": 422,
  "message": "Request validation failed",
  "error": {
    "code": "request.validation_failed",
    "fields": { "initialAmountMinor": "must be >= 100" },
    "details": {}
  },
  "meta": {
    "requestId": "req_01J9X2K7M3QF8YV4N0P6T1ABCS",
    "timestamp": "2026-07-01T12:00:01Z"
  }
}
```

- `meta.requestId` присваивается сервером — указывайте его при обращении в поддержку.
- `meta.timestamp` — RFC 3339 (UTC).

### Денежный формат

Все суммы — **целые числа в минимальных единицах** (minor units) вместе с явными `currency` и `scale`. Дробей и `float` в контракте нет.

```json
{ "amountMinor": 5000, "currency": "USD", "scale": 2 }   // = $50.00
```

- `scale` — число знаков после запятой: `USD` = 2, `USDT` = 6.
- **Единицы кошелька и карт РАЗНЫЕ:** кошелёк — `USDT/6`, карты — `USD/2`. Никогда не складывайте суммы без приведения `scale`.
- Перевод в отображаемое: `amount = amountMinor / 10^scale`.

### Обработка ошибок

Ветвите логику **только по `error.code`** — это стабильный машинный код. Поле `message` предназначено для человека и может меняться. Набор кодов **открытый**: всегда предусматривайте ветку по умолчанию для незнакомых значений.

- `error.fields` — при валидации (`422 request.validation_failed`): какое поле не прошло и почему.
- `error.details` — доп. контекст (например, `requiredScope` при `403`).

Полный перечень — в разделе [Справочник кодов ошибок](#справочник-кодов-ошибок).

### Идемпотентность

Все изменяющие операции (POST/PUT/DELETE, создающие эффект) **идемпотентны** — передавайте заголовок:

```
Idempotency-Key: <уникальная строка на операцию>
```

Повтор запроса с тем же ключом вернёт **тот же сохранённый ответ** (не выполнит операцию дважды). Тот же ключ с другим телом/путём → `409 idempotency.key_conflict`. Запрос в процессе → `409 idempotency.in_progress`. Для денежных операций (`fund`/`unload`/`close`) и создания продуктов ключ **обязателен**.

### Асинхронные операции

Денежные и эмиссионные операции — **асинхронные**. Ответ приходит сразу со статусом **`202 Accepted`** и `orderId`, но это ещё **не** окончательный результат:

```json
{
  "success": true, "status": 202, "message": "Accepted",
  "data": { "orderId": "0b1e7c9a-…", "status": "processing", "type": "issue" },
  "meta": { "…": "…" }
}
```

Узнать исход — двумя способами:

1. **Поллинг:** `GET /orders/{orderId}` до терминального статуса (`completed` / `failed` / `refunded`).
2. **Вебхук:** событие вроде `card.created` / `card.funded` / `card.failed`.

Асинхронные: `POST /cards` (issue), `POST /cards/{id}/fund`, `POST /cards/{id}/unload`, `DELETE /cards/{id}` (close). Синхронные (сразу терминальны): freeze/unfreeze и все чтения.

### Пагинация

Списки с курсором (`GET /cards`, `GET /cardholders`, `GET /account/transactions`) принимают `?limit=` и `?cursor=` и возвращают объект `pagination` **внутри `data`** (не в `meta`):

```json
{
  "data": {
    "items": [ "…" ],
    "pagination": { "limit": 50, "nextCursor": "eyJ…", "hasMore": true }
  }
}
```

Для следующей страницы передайте `?cursor=<nextCursor>`. Когда `hasMore=false` — `nextCursor` равен `null`. Списки с фиксированным лимитом (`GET /cards/products`, `GET /products`, `GET /cards/{id}/transactions`) объект `pagination` не возвращают.

`limit` **не валидируется строго**: значение вне диапазона `1..100` молча приводится к ближайшей границе (`>100` → `100`, `<1` → `1`), ошибка при этом не возвращается. Фактически применённый размер страницы всегда приходит в `data.pagination.limit` — ориентируйтесь на него, а не на отправленное значение.

### Ограничение частоты (rate limiting)

На каждый ответ приходят заголовки: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. При превышении — **`429 rate_limit.exceeded`** с заголовком `Retry-After` (секунды до следующей попытки). Реализуйте экспоненциальный backoff.

---

## Аккаунт

Группа операций уровня аккаунта: действующие параметры и лимиты, баланс кошелька в USDT, тарифная сетка по умолчанию и денежная история кошелька. Кошелёк аккаунта — первичный источник денежных данных: суммы возвращаются в целых minor-единицах вместе с полями `currency` и `scale`.

### `GET /account/info`
Возвращает действующие параметры аккаунта: минимальные и максимальные суммы операций, поддерживаемые валюты и схемы карт, квоты, rate-limits, доступные функции (secure-reveal, ретрансляция 3DS/OTP, режим KYC) и статус аккаунта. Это единственный endpoint, который остаётся доступным при `status=suspended` (на остальных приостановленный аккаунт получает 401). **Требуемый scope:** `account:read`.

Ключевое поле ответа — `capabilities`. Это **единственный источник актуальных параметров** аккаунта: минимумы и максимумы операций (`limits`), поддерживаемые валюты карт и кошелька, сети, схемы карт, набор включённых фич (`features`) и ограничения (`restrictions`). Клиент **не должен хардкодить эти лимиты и флаги** — они зависят от аккаунта и могут меняться. Значения читаются из этого ответа; допустимо кэшировать не более 5 минут.

Два флага `features` относятся к реквизитам карты и легко путаются: `secureApiRaw` — рабочий raw-путь `POST /cards/{cardId}/secure` (включается по договорённости), `secureReveal` — hosted-iframe через `POST /cards/{cardId}/reveal-token`, в текущем релизе всегда `false`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "accountId": "9c6f1a2e-4b1d-4c3a-8e6f-2d1c3b4a5f60",
    "environment": "live",
    "status": "active",
    "capabilities": {
      "cardCurrencies": ["USD"],
      "walletCurrencies": ["USDT"],
      "walletNetworks": { "USDT": ["TRON", "BSC", "ETHEREUM", "POLYGON", "AVALANCHE", "TON"] },
      "cardSchemes": ["visa", "mastercard"],
      "limits": {
        "minIssueAmountMinor": 500,
        "minFundMinor": 500,
        "minUnloadMinor": 500,
        "maxOperationMinor": 100000000,
        "maxFundMinor": 250000,
        "maxCardsPerCardholder": 5,
        "maxCardsPerAccount": 1000,
        "dailyFundingVolumeMinor": 500000000,
        "rateLimits": { "readPerMin": 600, "writePerMin": 20, "securePerMin": 10 }
      },
      "features": {
        "secureReveal": false,
        "secureApiRaw": false,
        "threeDsOtpRelay": "webhook",
        "tokenization": false,
        "kycRequired": false,
        "suspendedClearedByFund": true,
        "closeCooldownHours": 24,
        "physicalCards": false
      },
      "restrictions": { "blockedMcc": [], "blockedCountries": [] }
    },
    "webhooksConfigured": true,
    "createdAt": "2026-06-01T00:00:00Z"
  }
}
```

- **Частые ошибки** — `auth.unauthorized` (401) — ключ невалиден или отозван; `auth.scope_denied` (403) — у ключа нет требуемого scope; `rate_limit.exceeded` (429); `internal.error` (500).

### `GET /account/wallet`
Возвращает баланс кошелька аккаунта в USDT — по одному элементу на каждую программу. Валюта — **USDT, scale 6** (целые minor-единицы). Поле `onCardsMinor` — суммарный остаток на картах — выражено в валюте **карт** (`onCardsCurrency` / `onCardsScale`) с иным scale, чем у кошелька; не складывайте его с полями кошелька без приведения к единому scale. **Требуемый scope:** `account:read`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "providerCode": "core-1",
        "currency": "USDT",
        "scale": 6,
        "availableMinor": 15432000000,
        "reservedMinor": 520000000,
        "totalMinor": 15952000000,
        "onCardsMinor": 80000,
        "onCardsCurrency": "USD",
        "onCardsScale": 2,
        "availableUsd": "15432.00"
      }
    ]
  }
}
```

- **Частые ошибки** — `auth.unauthorized` (401); `auth.scope_denied` (403); `rate_limit.exceeded` (429); `internal.error` (500).

### `GET /account/pricing`
Возвращает тарифную сетку аккаунта по умолчанию (без привязки к конкретной карте). В сетке показаны только реально взимаемые статьи. Валюта тарифов — USD, scale 2. Версия плана здесь не возвращается: пара `(planCode, planVersion)` фиксируется в ответе `GET /tariffs/quote` и в ордере. Для тарифа конкретной карты используйте `GET /cards/{cardId}/tariff`, для точного расчёта стоимости операции — `GET /tariffs/quote`. **Требуемый scope:** `account:read`.

- **Query параметры**:
  - `productCode` (string, опц) — тарифная сетка для конкретного типа карты; тарифы могут отличаться по продуктам.
  - `currency` (string, опц) — валюта тарифов, 3-буквенный код, по умолчанию `USD`; невалидное значение молча заменяется на `USD`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "planCode": "default",
    "currency": "USD",
    "scale": 2,
    "fees": [
      { "feeItem": "issuance",    "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 500, "bps": 0,   "minMinor": 0,  "period": "none" },
      { "feeItem": "funding",     "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 0,   "bps": 250, "minMinor": 0,  "period": "none" },
      { "feeItem": "unload",      "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 0,   "bps": 100, "minMinor": 0,  "period": "none" },
      { "feeItem": "transaction", "collection": "usage",   "chargedFrom": "card",   "flatMinor": 20,  "bps": 0,   "minMinor": 0,  "period": "none" },
      { "feeItem": "fx",          "collection": "usage",   "chargedFrom": "card",   "flatMinor": 0,   "bps": 300, "minMinor": 50, "period": "none" },
      { "feeItem": "maintenance", "collection": "usage",   "chargedFrom": "card",   "flatMinor": 200, "bps": 0,   "minMinor": 0,  "period": "monthly" }
    ]
  }
}
```

- **Частые ошибки** — `auth.unauthorized` (401); `auth.scope_denied` (403); `422` `pricing.plan_missing` / `pricing.rate_missing` — тарифный план не резолвится для аккаунта (ошибка конфигурации, обратитесь в поддержку), либо `request.validation_failed` — параметры не приняты тарифным движком; `rate_limit.exceeded` (429); `internal.error` (500); `service.unavailable` (503) — внутренний сервис временно недоступен, можно повторить.

### `GET /account/transactions`
Возвращает денежную историю кошелька аккаунта (USDT, scale 6), от новых движений к старым. Это первичный источник денежных данных, в отличие от транзакций по картам. Страница возвращается через курсорную пагинацию (`pagination.nextCursor`). **Требуемый scope:** `transactions:read`.

- **Query параметры**:
  - `limit` (integer, опц) — размер страницы, 1..100, по умолчанию 20. Вне диапазона — молча клампится к границе; нечисловое значение трактуется как `1` (не как значение по умолчанию).
  - `cursor` (string, опц) — непрозрачный курсор из `pagination.nextCursor` предыдущей страницы; не конструируйте его вручную.
  - `type` (string, опц) — фильтр по типу движения. Значения: `deposit` (пополнение кошелька — перевод с основного баланса в личном кабинете), `card_funding` (списание под выпуск или пополнение карты), `card_fee` (комиссия), `card_unload` (зачисление с карты), `refund` (компенсация неудавшегося ордера), `program_return` (возврат средств из кошелька в основной баланс). Значение `adjustment` встречается в поле `type` **ответа** (display-fallback для нераспознанных внутренних типов), но фильтровать по нему нельзя — запрос вернёт `422`.
  - `provider` (string, опц) — фильтр по программе (алиас `core-{id}`, см. `providerCode` в `GET /account/wallet`). Опущен — движения по всем программам аккаунта. Неизвестное значение → `422`.
  - `from` (string, date-time, опц) — нижняя граница `occurredAt` (RFC 3339).
  - `to` (string, date-time, опц) — верхняя граница `occurredAt` (RFC 3339).

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "wtx_3f9a1c7e2b4d5a6f7c8e9d0a",
        "type": "card_funding",
        "direction": "out",
        "amountMinor": 10500000,
        "currency": "USDT",
        "scale": 6,
        "balanceAfterMinor": 15421500000,
        "orderId": "0b1e7c9a-0000-4000-8000-000000000002",
        "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
        "occurredAt": "2026-07-01T12:00:04Z"
      },
      {
        "id": "wtx_9d0a8c7e6b5a4f3e2d1c0b9a",
        "type": "deposit",
        "direction": "in",
        "amountMinor": 100000000,
        "currency": "USDT",
        "scale": 6,
        "balanceAfterMinor": 15432000000,
        "orderId": null,
        "cardId": null,
        "occurredAt": "2026-07-01T09:10:11Z"
      }
    ],
    "pagination": { "limit": 20, "nextCursor": null, "hasMore": false }
  }
}
```

- **Частые ошибки** — `request.malformed` (400) — в том числе невалидный `cursor`, а также `from`/`to` не в формате RFC 3339; `auth.unauthorized` (401); `auth.scope_denied` (403); `request.validation_failed` (422) — неизвестное значение `type` или `provider`, подробности в `error.fields`; `rate_limit.exceeded` (429); `internal.error` (500).

### `POST /account/deposit-address`
**Устаревший endpoint.** Пополнение баланса аккаунта через API-адрес не предусмотрено: баланс пополняется из личного кабинета, а не по on-chain адресу через API. Endpoint присутствует в контракте для совместимости, но всегда отвечает `422 not_supported`. Тело запроса не требуется, адрес не выдаётся. **Требуемый scope:** `account:write`.

- **Ответ** — `422`:

```json
{
  "success": false,
  "status": 422,
  "message": "This feature is not supported in the current account model",
  "error": { "code": "not_supported" }
}
```

- **Частые ошибки** — `not_supported` (422) — единственный штатный исход; `auth.unauthorized` (401); `auth.scope_denied` (403); `rate_limit.exceeded` (429); `internal.error` (500).

## Тарифы

Группа read-эндпоинтов для работы с ценообразованием. Комиссия всегда рассчитывается на сервере тем же движком, которым она будет фактически списана. Через каталог вы узнаёте доступные планы, через `GET /tariffs/quote` получаете точный предрасчёт стоимости операции (`feeMinor` / `totalChargeMinor`), а через `GET /cards/{cardId}/tariff` — действующую тарифную сетку конкретной карты. Все суммы — целые minor-единицы валюты карт (по умолчанию USD, scale 2). Все три эндпоинта требуют scope `tariffs:read`; он покрывается более широкими `account:read` или `cards:read` — отдельно запрашивать `tariffs:read` не нужно, если у ключа есть любой из них.

### `GET /tariffs/plans`
Возвращает каталог публичных тарифных планов. Приватные планы назначаются платформой и в каталоге не отображаются (через API приватный план неотличим от несуществующего). Каталог не содержит ставок — сами ставки читаются через тарифную сетку или предрасчёт. **Требуемый scope:** `tariffs:read` (покрывается `account:read` / `cards:read`).

- **Query параметры**
  - `currency` (string, опц) — валюта карт, по умолчанию `USD`.

- **Ответ** — `200`. В `data.items` — список планов; каждый содержит `code` (стабильный код для использования в других эндпоинтах), `name`, `version` (актуальная версия, информационно) и `isDefault`.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      { "code": "default", "name": "Standard", "version": 3, "isDefault": true },
      { "code": "volume", "name": "Volume", "version": 1, "isDefault": false }
    ]
  }
}
```

- **Частые ошибки**
  - `401` — ключ не авторизован.
  - `403` — доступ запрещён.
  - `422` — параметры не приняты тарифным движком (`pricing.plan_missing`, `pricing.rate_missing`).
  - `429` `rate_limit.exceeded` — превышен лимит запросов.
  - `503` `service.unavailable` — внутренний сервис временно недоступен, можно повторить.

### `GET /tariffs/quote`
Точный предрасчёт комиссии до выполнения операции. Считается тем же движком, что и фактическое списание: в пределах актуальной версии плана расчёт совпадает со списанием. Quote не резервирует цену — если между расчётом и операцией сменится версия плана (окно смены — секунды), комиссия спишется по актуальной версии. Без контекстных параметров расчёт выполняется по плану аккаунта по умолчанию. **Требуемый scope:** `tariffs:read` (покрывается `account:read` / `cards:read`).

- **Query параметры**
  - `operation` (string, обяз) — тип операции: `issue`, `fund` или `unload`.
  - `amountMinor` (integer, обяз) — сумма операции в minor-единицах, `> 0` и `≤ limits.maxOperationMinor` (валюта карт USD, scale 2).
  - `cardId` (string, опц) — применить per-card тариф; тип карты учитывается автоматически. Чужой или несуществующий → `404`.
  - `cardholderId` (string, опц) — применить тариф держателя (для `operation=issue`, когда карта ещё не выпущена). Чужой или несуществующий → `404`.
  - `productCode` (string, опц) — применить тариф типа карты (для `operation=issue` без привязки к держателю).

- **Ответ** — `200`. Ключевые поля: `amountMinor` (сумма нетто, столько получит или отдаст карта), `feeMinor` (комиссия), `totalChargeMinor` (`amountMinor + feeMinor` — столько спишется с кошелька; для `unload` комиссия вычитается из выводимой суммы), а также зафиксированная пара `planCode` / `planVersion`. Значения `feeMinor` и `totalChargeMinor` совпадут с фактическим списанием.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "operation": "fund",
    "currency": "USD",
    "scale": 2,
    "amountMinor": 10000,
    "feeMinor": 250,
    "totalChargeMinor": 10250,
    "planCode": "default",
    "planVersion": 3
  }
}
```

- **Частые ошибки**
  - `404` `card.not_found` / `cardholder.not_found` — указан чужой или несуществующий `cardId` / `cardholderId`.
  - `422` `request.validation_failed` — неверные параметры (например, `amountMinor` вне допустимого диапазона); подробности в `error.fields`. Также возможны `pricing.*`, `not_supported`.
  - `429` `rate_limit.exceeded` — превышен лимит запросов.
  - `503` `service.unavailable` — внутренний сервис временно недоступен, можно повторить.

### `GET /cards/{cardId}/tariff`
Возвращает действующую тарифную сетку карты. Схема ответа совпадает с `/account/pricing`, но резолв выполняется с учётом привязок на уровне карты и держателя. **Требуемый scope:** `tariffs:read` (покрывается `cards:read`).

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты. Чужой или несуществующий → `404` `card.not_found`.

- **Ответ** — `200`. В `data` — тарифная сетка `PricingSchedule`: `planCode` (или `null`, если план не назначен), `currency`, `scale` и массив `fees`. Публикуются только реально взимаемые статьи — если статьи нет в ответе, она не взимается. Комиссия статьи считается по формуле `fee = max(minMinor, flatMinor + round(amount × bps / 10000))` (округление half-up в целочисленной арифметике; `1 bps = 0.01%`). Поле `collection` = `upfront` означает списание с кошелька в момент операции, `usage` — списание с баланса карты при событии использования.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "planCode": "default",
    "currency": "USD",
    "scale": 2,
    "fees": [
      { "feeItem": "issuance", "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 500, "bps": 0, "minMinor": 0, "period": "none" },
      { "feeItem": "funding", "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 0, "bps": 250, "minMinor": 0, "period": "none" },
      { "feeItem": "unload", "collection": "upfront", "chargedFrom": "wallet", "flatMinor": 0, "bps": 100, "minMinor": 0, "period": "none" },
      { "feeItem": "transaction", "collection": "usage", "chargedFrom": "card", "flatMinor": 20, "bps": 0, "minMinor": 0, "period": "none" },
      { "feeItem": "fx", "collection": "usage", "chargedFrom": "card", "flatMinor": 0, "bps": 300, "minMinor": 50, "period": "none" },
      { "feeItem": "maintenance", "collection": "usage", "chargedFrom": "card", "flatMinor": 200, "bps": 0, "minMinor": 0, "period": "monthly" }
    ]
  }
}
```

- **Частые ошибки**
  - `404` `card.not_found` — карта не существует или принадлежит другому аккаунту.
  - `422` `pricing.plan_missing` — тарифный план не найден, неактивен или приватен (ошибка конфигурации — обратитесь в поддержку); также `pricing.rate_missing`.
  - `429` `rate_limit.exceeded` — превышен лимит запросов.
  - `503` `service.unavailable` — внутренний сервис временно недоступен, можно повторить.

## Держатели карт (Cardholders)

Держатель — это конечный пользователь, на которого выпускаются карты. Группа позволяет зарегистрировать держателя (со снимком его персональных данных), получить список и карточку держателя, а также деактивировать его. Персональные данные (PII) передаются один раз при создании и наружу не возвращаются: на read-путях доступны только `displayName` и `email` (последний — как канал доставки OTP/3DS-кодов).

### `POST /cardholders`
Создаёт держателя карт либо возвращает уже существующего. Все PII-поля обязательны и валидируются до создания; PII сохраняется как снимок и в ответах не возвращается. **Требуемый scope:** `cardholders:write`.

Операция идемпотентна по `externalRef`: повтор с тем же значением возвращает существующего держателя с кодом `200` (без изменений). Заголовок `Idempotency-Key` обязателен.

- **Тело запроса** — поля:
  - `externalRef` (string, обяз) — ваш стабильный уникальный идентификатор пользователя, неизменяем.
  - `providerCode` (string, обяз) — код программы в формате `core-{id}` (например, `core-1`).
  - `firstName` (string, обяз), `lastName` (string, обяз).
  - `email` (string, обяз) — на этот адрес доставляются 3DS/OTP-коды.
  - `phone` (string, обяз) — формат E.164 (`+15551234567`).
  - `dateOfBirth` (string, обяз) — `YYYY-MM-DD`, возраст ≥ 18 лет.
  - `country` (string, обяз) — ISO-3166-1 alpha-2.
  - `address` (string, обяз), `city` (string, обяз), `state` (string, обяз), `zipCode` (string, обяз).

```json
{
  "externalRef": "user-42",
  "providerCode": "core-1",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+15551234567",
  "dateOfBirth": "1990-01-31",
  "country": "US",
  "address": "1 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001"
}
```

- **Ответ** — `201` (создан) или `200` (уже существовал по `externalRef`):

```json
{
  "success": true,
  "status": 201,
  "message": "Created",
  "data": {
    "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
    "externalRef": "user-42",
    "providerCode": "core-1",
    "status": "active",
    "kycStatus": "waived",
    "displayName": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-07-01T12:00:00Z"
  }
}
```

- **Частые ошибки:**
  - `request.idempotency_key_required` (400) — не передан заголовок `Idempotency-Key`.
  - `request.validation_failed` (422) — невалидные поля (подробности в `error.fields`), либо данные держателя отклонены.
  - `idempotency.in_progress` / `idempotency.key_conflict` (409) — конфликт по ключу идемпотентности.
  - `quota.exceeded` (429) — исчерпана квота аккаунта на число держателей; держатель не создан.

### `GET /cardholders`
Возвращает страницу держателей из локальной копии данных (eventually-consistent — свежие изменения могут появиться с небольшой задержкой). **Требуемый scope:** `cardholders:read`.

- **Query параметры:**
  - `limit` (integer, опц) — размер страницы, 1..100, по умолчанию 20.
  - `cursor` (string, опц) — непрозрачный курсор из `pagination.nextCursor` предыдущей страницы.
  - `status` (string, опц) — фильтр по статусу: `active`, `inactive`, `suspended`.
  - `externalRef` (string, опц) — точный поиск по вашему `externalRef`.
  - `provider` (string, опц) — фильтр по программе (алиас `core-{id}`, например `core-1`). Держатель привязан к программе, под которой создан. Опущен — все программы; неизвестное значение → `422`.

- **Ответ** — `200`, страница держателей:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
        "externalRef": "user-42",
        "providerCode": "core-1",
        "status": "active",
        "kycStatus": "waived",
        "displayName": "John Doe",
        "email": "john@example.com",
        "createdAt": "2026-07-01T12:00:00Z"
      }
    ],
    "pagination": { "limit": 20, "nextCursor": null, "hasMore": false }
  }
}
```

- **Частые ошибки:**
  - `auth.scope_denied` (403) — у ключа нет scope `cardholders:read`.
  - `request.malformed` (400) — невалидный `cursor`.
  - `request.validation_failed` (422) — неизвестное значение `status` / `provider` либо `externalRef` длиннее 128 символов.

### `GET /cardholders/{cardholderId}`
Возвращает одного держателя по идентификатору. **Требуемый scope:** `cardholders:read`.

- **Path параметры:**
  - `cardholderId` (string, обяз) — идентификатор держателя; чужой или несуществующий → `404 cardholder.not_found`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
    "externalRef": "user-42",
    "providerCode": "core-1",
    "status": "active",
    "kycStatus": "waived",
    "displayName": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-07-01T12:00:00Z"
  }
}
```

- **Частые ошибки:**
  - `cardholder.not_found` (404) — держатель не существует или принадлежит другому аккаунту.

### `PATCH /cardholders/{cardholderId}`
Обновление держателя. **Заглушка: недоступна в текущем релизе.** На **любой** запрос возвращает `422 not_supported` — KYC-данные неизменяемы после регистрации, обновление держателя не поддерживается. `cardholderId` не проверяется (чужой или несуществующий даёт тот же `422`, а не `404`), тело запроса не читается и полностью игнорируется. **Требуемый scope:** `cardholders:write`.

Планируемое поведение (в будущих релизах) — изменение только полей `email` (канал доставки OTP) и `displayName`. Пока изменить данные держателя можно только созданием нового держателя с другим `externalRef`.

- **Path параметры:**
  - `cardholderId` (string, обяз) — идентификатор держателя.

- **Тело запроса** — в текущем релизе игнорируется; форма ниже зарезервирована для будущего релиза (минимум одно поле):
  - `email` (string, опц), `displayName` (string, опц).

```json
{ "email": "new@example.com", "displayName": "J. Doe" }
```

- **Ответ** — в текущем релизе `422`:

```json
{
  "success": false,
  "status": 422,
  "message": "This endpoint is declared in the API contract but is not available in the current release",
  "error": { "code": "not_supported" }
}
```

### `DELETE /cardholders/{cardholderId}`
Деактивирует держателя (soft-disable) — запись не удаляется. Возможно только при отсутствии активных карт (активной считается карта, чей статус не входит в `closed`/`expired`/`failed`). После деактивации выпуск карт на такого держателя невозможен. **Требуемый scope:** `cardholders:write`.

- **Path параметры:**
  - `cardholderId` (string, обяз) — идентификатор держателя.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
    "status": "inactive"
  }
}
```

- **Частые ошибки:**
  - `cardholder.has_active_cards` (409) — у держателя есть активные карты; деактивация запрещена.
  - `cardholder.not_eligible` (422) — при попытке выпустить карту на держателя в статусе `inactive`.
  - `cardholder.not_found` (404) — держатель не существует или принадлежит другому аккаунту.

### `POST /cardholders/{cardholderId}/kyc`
Подача KYC. **Заглушка: недоступна в текущем релизе.** Endpoint возвращает `422 kyc.not_supported` на **любой** запрос — `cardholderId` не проверяется (в том числе чужой или несуществующий: `404` здесь не возвращается), тело не читается. При `features.kycRequired=false` KYC и не требуется (`kycStatus=waived`). **Требуемый scope:** `cardholders:write`.

Изменения `kycStatus` в дальнейшем доставляются событиями `cardholder.kyc_approved` и `cardholder.kyc_rejected` и отражаются в ответе `GET /cardholders/{cardholderId}`.

- **Path параметры:**
  - `cardholderId` (string, обяз) — идентификатор держателя.

- **Ответ** — в текущем релизе `422`:

```json
{
  "success": false,
  "status": 422,
  "message": "KYC submission is not supported in v1; KYC status is delivered via webhooks",
  "error": { "code": "kyc.not_supported" }
}
```

- **Частые ошибки:**
  - `kyc.not_supported` (422) — подача KYC недоступна в текущем релизе; единственный штатный исход.

## Карты — выпуск и обслуживание

Группа операций жизненного цикла виртуальной карты: выпуск, просмотр списка и деталей, живой баланс, история транзакций и закрытие. Денежные суммы везде указываются в целых minor-единицах валюты карты (поля `*Minor`) вместе с `currency` и `scale` (для USD `scale` = 2, то есть `800` = 8.00 USD). Выпуск и закрытие карты — асинхронные: сервер отвечает `202 Accepted` с `orderId`, а окончательный результат приходит вебхуками и через `GET /orders/{orderId}`.

### `POST /cards`
Выпускает новую карту для держателя. Списывает с кошелька суммарный платёж `totalChargeMinor = initialAmountMinor + fee(issuance)` по действующему тарифу (комиссия funding при выпуске не взимается). **Требуемый scope:** `cards:write`

Операция **асинхронная**: ответ `202 Accepted` с `orderId` означает только приём в обработку, но не исполнение. Итог отслеживайте по вебхукам `card.created` / `card.failed` или через `GET /orders/{orderId}` (терминальный статус `failed`|`refunded` сопровождается полем `failureCode`). Заголовок `Idempotency-Key` обязателен. Комиссию клиент не передаёт; лишние поля в теле приводят к `422 request.validation_failed`.

- **Тело запроса**
  - `cardholderId` (string, обязательно) — идентификатор держателя.
  - `providerCode` (string, обязательно) — код программы в формате `core-{id}`, например `core-1`.
  - `productCode` (string, обязательно) — код продукта из `GET /cards/products`; значения по умолчанию нет.
  - `initialAmountMinor` (integer, обязательно) — стартовая сумма на карте в minor-единицах, в пределах лимитов операции.
  - `currency` (string, опц.) — по умолчанию `USD`.
  - `nameOnCard` (string, опц.) — эмбоссинг заглавными ASCII (2–26 символов); по умолчанию имя держателя.
  - `externalReference` (string, опц.) — ваша ссылка на операцию: произвольная метка для сверки на вашей стороне, возвращается в объекте ордера (ответ операции, `GET /orders/{orderId}`) и в событиях вебхуков. **Сервер не проверяет её уникальность и не дедупит по ней** — за идемпотентность отвечает только заголовок `Idempotency-Key`; повтор одной и той же ссылки создаст отдельные операции.

```json
{
  "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
  "providerCode": "core-1",
  "productCode": "vusa",
  "initialAmountMinor": 5000,
  "currency": "USD",
  "nameOnCard": "JOHN DOE",
  "externalReference": "issue-u42-001"
}
```

- **Ответ** — `202 Accepted`:

```json
{
  "success": true,
  "status": 202,
  "message": "Accepted",
  "data": {
    "orderId": "0b1e7c9a-0000-4000-8000-000000000002",
    "type": "issue",
    "status": "processing"
  }
}
```

- **Частые ошибки**
  - `card.product_unknown` / `card.product_not_issuable` (422) — неизвестный или недоступный для выпуска продукт.
  - `wallet.insufficient_balance` (422) — на кошельке недостаточно средств для суммы плюс комиссии.
  - `cardholder.not_eligible` (422) — держатель не проходит по требованиям.
  - `funding.below_minimum` / `amount.exceeds_maximum` (422) — сумма вне допустимого диапазона.
  - `request.validation_failed` (422) — ошибка валидации тела (в том числе лишние поля).
  - `idempotency.in_progress` / `idempotency.key_conflict` (409) — конфликт по `Idempotency-Key`.

### `GET /cards`
Возвращает карты аккаунта. Данные обновляются с небольшой задержкой (eventually consistent). Поле `balance` в элементах списка заполняется **по мере возможности** (best-effort, кэш ~20 секунд): для терминальных карт (`closed`/`expired`/`failed`) и при ошибке загрузки баланса оно равно `null`. Для гарантированно живого значения используйте `GET /cards/{cardId}/balance`. **Требуемый scope:** `cards:read`

Постраничный вывод — курсорный (общие правила пагинации описаны отдельно).

- **Query параметры**
  - `limit` (integer, опц.) — размер страницы, 1–100, по умолчанию 20.
  - `cursor` (string, опц.) — непрозрачный курсор из `pagination.nextCursor` предыдущей страницы.
  - `status` (string, опц.) — фильтр по статусу карты: `issuing`, `active`, `frozen`, `suspended`, `closed`, `expired`.
  - `cardholderId` (string, опц.) — фильтр по держателю.
  - `provider` (string, опц.) — фильтр по программе (алиас `core-{id}`, например `core-1`). Опущен → карты всех программ. Неизвестный код → `422 request.validation_failed`.

- **Ответ** — `200 OK`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
        "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
        "status": "active",
        "productCode": null,
        "scheme": "visa",
        "maskedNumber": "···· ···· ···· 4242",
        "last4": "4242",
        "currency": "USD",
        "scale": 2,
        "balance": {
          "availableMinor": 800,
          "pendingMinor": 0,
          "totalMinor": 800,
          "negative": false,
          "syncedAt": "2026-07-01T12:33:00Z"
        }
      }
    ],
    "pagination": { "limit": 20, "nextCursor": null, "hasMore": false }
  }
}
```

- **Частые ошибки**
  - `request.malformed` (400) — невалидный `cursor`.
  - `request.validation_failed` (422) — недопустимое значение `status` или неизвестный `provider` (подробности в `error.fields`).
  - `rate_limit.exceeded` (429) — превышен лимит запросов.

### `GET /cards/{cardId}`
Возвращает детали одной карты. Поле `balance` в этом ответе **всегда `null`** — актуальный баланс получайте через `GET /cards/{cardId}/balance` (в отличие от списка `GET /cards`, где баланс заполняется best-effort). **Требуемый scope:** `cards:read`

Пока `status = issuing`, поля `last4`, `maskedNumber`, `expMonth`, `expYear` могут быть `null` — они дозаполняются после завершения асинхронного выпуска. Поля `productCode`, `nameOnCard` и `externalReference` в текущем релизе всегда `null` (локально не зеркалятся). Незнакомые поля ответа игнорируйте (обратная совместимость).

- **Path параметры**
  - `cardId` (string, обязательно) — идентификатор карты; чужой или несуществующий даёт `404`.

- **Ответ** — `200 OK`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
    "status": "active",
    "productCode": null,
    "scheme": "visa",
    "maskedNumber": "···· ···· ···· 4242",
    "last4": "4242",
    "expMonth": 12,
    "expYear": 2028,
    "currency": "USD",
    "scale": 2,
    "nameOnCard": null,
    "planCode": "default",
    "externalReference": null,
    "balance": null,
    "issuedAt": "2026-07-01T12:00:04Z",
    "closedAt": null
  }
}
```

- **Частые ошибки**
  - `card.not_found` (404) — карта не существует или принадлежит другому аккаунту/окружению.

### `GET /cards/{cardId}/balance`
Возвращает живой баланс карты. **Требуемый scope:** `cards:read`

`availableMinor` = `totalMinor` минус активные авторизационные холды; **ниже нуля не опускается** (клампится в `≥ 0`). Признак `negative = true` означает, что отрицателен `totalMinor` — то есть забукированный баланс ушёл в минус и на карте реальный дефицит средств. Для этого признака `availableMinor` не используется.

- **Path параметры**
  - `cardId` (string, обязательно) — идентификатор карты.

- **Ответ** — `200 OK`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "currency": "USD",
    "scale": 2,
    "availableMinor": 800,
    "pendingMinor": 1200,
    "totalMinor": 2000,
    "negative": false,
    "syncedAt": "2026-07-01T12:33:00Z"
  }
}
```

- **Частые ошибки**
  - `card.not_found` (404) — карта не найдена.

### `GET /cards/{cardId}/transactions`
Возвращает последние транзакции карты, отсортированные по `occurredAt` по убыванию. Это витрина истории по карте, а не источник денежной истины по кошельку — движения баланса кошелька смотрите в `GET /account/transactions`. **Требуемый scope:** `transactions:read` (покрывается `cards:read`).

Число записей ограничено сервером; курсорной пагинации нет (объект `pagination` не возвращается). В списке присутствуют и **отклонённые авторизации**: у них `status = declined` и заполнено поле `declineCode` (закрытый набор причин; при отсутствии совпадения — `other`).

**Связывание комиссий и деклайнов с покупкой (combine).** У строки покупки заполнен `authorizationCode`, а у порождённых ею строк комиссии (`type = fee`) и отклонённых авторизаций (`status = declined`) — `relatedAuthorizationCode`, равный `authorizationCode` покупки. Чтобы отнести комиссию к покупке и показать итог по ней, группируйте строки по совпадению `relatedAuthorizationCode` == `authorizationCode`. Поле `feeMinor` — итоговая комиссия по строке одним числом; `0` — комиссия не взимается. У несвязанных строк оба кода — `null`; `occurredAt` тоже может быть `null`, если момент операции не передан источником.

**Не выводите баланс арифметикой по этим строкам.** Список — витрина операций, а не леджер: не каждая строка двигает баланс (авторизация лишь удерживает сумму, отклонённая попытка не двигает ничего), а часть движений сюда не попадает. Единой формулы «сумма по строкам = баланс» не существует, и подгонять её не нужно — источник истины ровно один: `GET /cards/{cardId}/balance`.

Два момента, на которых чаще всего ошибаются:

- на строке `type = fee` сама строка **и есть** комиссия: `amountMinor` — составляющая `feeMinor`, складывать их нельзя (получится двойной счёт);
- комиссия может списаться отдельным движением уже после самой операции, поэтому мгновенной сходимости по времени не ждите.

- **Path параметры**
  - `cardId` (string, обязательно) — идентификатор карты.
- **Query параметры**
  - `limit` (integer, опц.) — 1–200, по умолчанию 50.

- **Ответ** — `200 OK` (поле `type`: `authorization`, `settlement`, `fee`, `refund`, `reversal`; `status`: `pending`, `completed`, `declined`, `refunded`, `reversed`):

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "id": "5d6e7f8a-0000-4000-8000-000000000007",
        "type": "settlement",
        "status": "completed",
        "amountMinor": 1299,
        "feeMinor": 0,
        "currency": "USD",
        "scale": 2,
        "merchantName": "GROCERY STORE",
        "mcc": "5411",
        "mccDescription": "Grocery Stores",
        "merchantCountry": "US",
        "declineCode": null,
        "feeType": null,
        "authorizationCode": "A1B2C3",
        "relatedAuthorizationCode": null,
        "occurredAt": "2026-07-01T10:11:12Z"
      },
      {
        "id": "6e7f8a9b-0000-4000-8000-000000000008",
        "type": "fee",
        "status": "completed",
        "amountMinor": 50,
        "feeMinor": 50,
        "currency": "USD",
        "scale": 2,
        "merchantName": null,
        "mcc": null,
        "mccDescription": null,
        "merchantCountry": null,
        "declineCode": null,
        "feeType": "cross_border",
        "authorizationCode": null,
        "relatedAuthorizationCode": "A1B2C3",
        "occurredAt": "2026-07-01T10:11:13Z"
      }
    ]
  }
}
```

Поля `merchantName` и `mccDescription` — недоверенный отображаемый текст: экранируйте при выводе и не используйте для ветвления логики.

- **Частые ошибки**
  - `card.not_found` (404) — карта не найдена.
  - `auth.scope_denied` (403) — у ключа нет scope `transactions:read` / `cards:read`.
  - `rate_limit.exceeded` (429) — превышен лимит запросов.

### `DELETE /cards/{cardId}`
Закрывает карту. Операция **необратима**; заголовок `Idempotency-Key` обязателен. **Требуемый scope:** `cards:write`

Поведение зависит от остатка на карте:
- Баланс равен 0 — закрытие выполняется синхронно, ответ `200 OK`.
- На карте есть остаток — он сначала выводится на кошелёк отдельным **unload-ордером** (комиссия за вывод остатка при закрытии не взимается), после чего карта закрывается. Ответ `202 Accepted` с `orderId`; окончательный результат приходит событиями `card.unloaded` и `card.closed` и доступен через `GET /orders/{orderId}`. Отдельного типа ордера `close` нет — используется тип `unload`.

Повторный запрос по уже закрытой карте с тем же `Idempotency-Key` возвращает исходный результат (`200`).

- **Path параметры**
  - `cardId` (string, обязательно) — идентификатор карты.
- **Тело запроса** — не требуется и не читается: в текущем релизе причина закрытия нигде не сохраняется. Отправляйте пустой объект `{}` либо не отправляйте тело вовсе.

- **Ответ** — `200 OK` (синхронно, баланс был 0):

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "status": "closed",
    "closedAt": "2026-07-01T13:00:00Z",
    "residualMinor": 0,
    "currency": "USD",
    "scale": 2
  }
}
```

- **Ответ** — `202 Accepted` (остаток выводится unload-ордером). Если по карте уже идёт вывод остатка, в `data` возвращается признак ожидания — повторите `DELETE` с тем же `Idempotency-Key`:

```json
{
  "success": true,
  "status": 202,
  "message": "Accepted",
  "data": {
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "status": "closing",
    "orderId": "7a2b3c4d-0000-4000-8000-000000000005",
    "type": "unload"
  }
}
```

- **Частые ошибки**
  - `card.too_new_to_close` (422) — карта создана недавно, период закрытия ещё не истёк.
  - `card.invalid_state` / `card.frozen` / `operation.pending_reconciliation` (409) — карта в состоянии, несовместимом с закрытием, либо по ней уже идёт незавершённая операция (дождитесь её завершения поллингом, не выполняйте компенсацию).
  - `card.lifecycle_cooldown` (429) — слишком частые lifecycle-операции по одной карте (пауза ~10 секунд, см. `Retry-After`).
  - `card.not_found` (404) — карта не найдена.

## Карты — деньги, заморозка, реквизиты

Эта группа объединяет операции над уже выпущенной картой: пополнение и вывод средств, временную блокировку (заморозку/разморозку) и получение чувствительных реквизитов (PAN/CVV). Денежные операции (`fund`, `unload`) выполняются асинхронно — сразу возвращается `202 Accepted` с `orderId`, а окончательный результат приходит вебхуком и доступен через `GET /orders/{orderId}`. Заморозка/разморозка синхронны. Все суммы указываются в целых minor-единицах валюты карты (USD, scale 2): например, `10000` = 100.00 USD.

### `POST /cards/{cardId}/fund`
Пополняет карту. `amountMinor` — это сумма нетто, зачисляемая на карту; с кошелька списывается `amountMinor + feeMinor` (комиссию можно рассчитать заранее через `GET /tariffs/quote?operation=fund&cardId=…`). Операция асинхронная. **Требуемый scope:** `cards:write`.

Заголовок `Idempotency-Key` обязателен.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Тело запроса**
  - `amountMinor` (integer int64, обяз) — сумма нетто на карту, в пределах `[limits.minFundMinor, limits.maxFundMinor]`. Пополнение гейтится `maxFundMinor` (жёстче, чем `maxOperationMinor`, который применяется к выводу); превышение → `422 amount.exceeds_maximum` до создания ордера.
  - `currency` (string, опц) — валюта карты, по умолчанию `USD`.
  - `externalReference` (string, опц) — ваш идентификатор операции (1–64 символа).

```json
{ "amountMinor": 10000, "currency": "USD", "externalReference": "fund-001" }
```

- **Ответ** — `202 Accepted` (принято в исполнение). Отслеживайте итог по `orderId`.

```json
{
  "success": true,
  "status": 202,
  "message": "Accepted",
  "data": { "orderId": "9f3c1a2b-0000-4000-8000-000000000006", "type": "fund", "status": "processing" }
}
```

В редких случаях синхронного завершения возвращается `200` с полным объектом ордера (`status=completed`). Если операция не удалась уже после `202`, ордер переходит в `refunded` с полем `failureCode` (событие `card.funding_failed`), а списание с кошелька компенсируется автоматически.

- **Частые ошибки**
  - `funding.below_minimum` (422) — сумма меньше минимума операции.
  - `amount.exceeds_maximum` (422) — сумма больше максимума.
  - `wallet.insufficient_balance` (422) — недостаточно средств на кошельке.
  - `card.frozen` (409) — карта заморожена, пополнение недоступно.
  - `card.invalid_state` (409) — карта в неподходящем статусе.
  - `idempotency.in_progress` (409) — операция с этим ключом ещё выполняется (повторите с тем же ключом после `Retry-After`).

### `POST /cards/{cardId}/unload`
Выводит средства с карты на кошелёк. `amountMinor` — сумма брутто, списываемая с карты; наша комиссия вычитается из фактически снятого, кошелёк ничего не резервирует заранее. На кошелёк зачисляется `creditedMinor` = фактически снятое минус `feeMinor`. Операция асинхронная. **Требуемый scope:** `cards:write`.

Заголовок `Idempotency-Key` обязателен.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Тело запроса**
  - `amountMinor` (integer int64, обяз) — сумма брутто с карты, `≥ limits.minUnloadMinor`.
  - `currency` (string, опц) — валюта карты, по умолчанию `USD`.
  - `externalReference` (string, опц) — ваш идентификатор операции (1–64 символа).

```json
{ "amountMinor": 5000, "currency": "USD", "externalReference": "unl-001" }
```

- **Ответ** — `202 Accepted` (принято в исполнение). Итоговые `unloadedMinor`, `feeMinor` и `creditedMinor` доступны в терминальном ордере и в событии `card.unloaded`.

```json
{
  "success": true,
  "status": 202,
  "message": "Accepted",
  "data": { "orderId": "7a2b3c4d-0000-4000-8000-000000000005", "type": "unload", "status": "processing" }
}
```

При частичном исполнении комиссия пропорциональна фактически снятой сумме, округление — в пользу клиента. Если операция не удалась после `202`, ордер переходит в `failed` (событие `card.unloading_failed`), баланс карты при этом не меняется. Возможен синхронный `200` с полным объектом ордера.

- **Частые ошибки**
  - `amount.exceeds_maximum` (422) — сумма больше максимума.
  - `card.insufficient_balance` (422) — недостаточно средств на карте.
  - `card.frozen` / `card.invalid_state` (409) — карта в неподходящем статусе.
  - `idempotency.in_progress` (409) — операция с этим ключом ещё выполняется.

### `POST /cards/{cardId}/freeze`
Замораживает карту: пока карта заморожена, авторизации отклоняются, а пополнение возвращает `409 card.frozen`. Операция синхронна и идемпотентна по своей природе — повторная заморозка уже замороженной карты это no-op с ответом `200`, поэтому `Idempotency-Key` необязателен. **Требуемый scope:** `cards:write`.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Тело запроса** — не требуется и не читается: причина заморозки в текущем релизе нигде не сохраняется, а в событии `card.frozen` всегда приходит `reason: client_request`. Отправляйте пустой объект `{}` либо не отправляйте тело вовсе.

- **Ответ** — `200 OK` (заморожена).

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5", "status": "frozen", "frozenAt": "2026-07-01T12:40:00Z" }
}
```

При таймауте возвращается `202` (статус придёт событием `card.frozen` или через `GET /cards/{cardId}`) — запрос можно безопасно повторить.

- **Частые ошибки**
  - `card.invalid_state` (409) — карта в статусе, не допускающем заморозку.
  - `card.lifecycle_cooldown` (429) — слишком частые lifecycle-операции по карте; пауза около 10 секунд, см. заголовок `Retry-After`.

### `POST /cards/{cardId}/unfreeze`
Размораживает карту (симметрична заморозке), возвращая её в статус `active`. Операция синхронна, `Idempotency-Key` необязателен. **Требуемый scope:** `cards:write`.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Тело запроса** — необязательно, пустой объект `{}`.

- **Ответ** — `200 OK` (разморожена).

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5", "status": "active", "unfrozenAt": "2026-07-01T12:45:00Z" }
}
```

При таймауте возвращается `202` (статус придёт событием `card.unfrozen` или через `GET /cards/{cardId}`).

- **Частые ошибки**
  - `card.invalid_state` (409) — статус `suspended` этой операцией не снимается; он снимается только успешным пополнением.
  - `card.lifecycle_cooldown` (429) — слишком частые lifecycle-операции по карте; пауза около 10 секунд.

### `POST /cards/{cardId}/secure`
Возвращает чувствительные реквизиты карты (PAN, CVV, срок действия) в JSON. Доступно только при включённой возможности `secureApiRaw` — включение не self-serve, предоставляется по договорённости при действующей PCI-аттестации вашей стороны, с IP-allowlist и mTLS. Доступно только для карт со `status=active`. **Требуемый scope:** `cards:secure:read`.

Реквизиты передаются transient-only: не сохраняются и не логируются ни на одном участке — не логируйте и не кэшируйте ответ на своей стороне. `Idempotency-Key` не используется (операция чтения). Заголовок `Cache-Control: no-store` в текущем релизе **не** проставляется — запрет кэширования обеспечивайте на своей стороне.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Тело запроса** — не требуется и игнорируется; всегда возвращаются все реквизиты (`pan`, `cvv`, `expMonth`, `expYear`). Фильтрация по подмножеству полей в текущем релизе не поддерживается.

- **Ответ** — `200 OK` (реальный пример PAN намеренно не приводится). Структура тела `data`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5", "pan": "…", "cvv": "…", "expMonth": 12, "expYear": 2029 }
}
```

- **Частые ошибки**
  - `secure.disabled` (403) — защищённый режим не включён для аккаунта либо отказано по scope.
  - `card.not_revealable` (409) — карта не в статусе `active`.
  - `rate_limit.exceeded` (429) — запросы к защищённым методам расходуют **общую write-корзину аккаунта** (20 запросов/мин); при превышении в `error.details.retryAfter` приходит пауза в секундах. Выделенная secure-корзина (per-card на час/сутки, per-account, глобальный circuit-breaker) и `details.scope=secure` — в планах, в текущем релизе не применяются.

### `POST /cards/{cardId}/reveal-token`
Предназначена для создания одноразовой reveal-сессии и `iframeUrl` защищённого origin, чтобы показать PAN/CVV пользователю в hosted-iframe (реквизиты не проходят через ваш бэкенд).

**Заглушка: в текущем релизе операция недоступна** — токенизация не поддерживается. На **любой** запрос возвращается `422 not_supported`: `cardId` не проверяется (чужой или несуществующий даёт тот же `422`, а не `404`), тело не читается, reveal-сессия и `iframeUrl` не создаются. Соответственно `features.secureReveal` всегда `false`. Прямой путь получения реквизитов — `POST /cards/{cardId}/secure`. **Требуемый scope:** `cards:secure:read`.

- **Path параметры**
  - `cardId` (string, обяз) — идентификатор карты.

- **Ответ** — `422 Unprocessable Entity` с кодом `not_supported`.

```json
{
  "success": false,
  "status": 422,
  "message": "This endpoint is declared in the API contract but is not available in the current release",
  "error": { "code": "not_supported" }
}
```

- **Частые ошибки**
  - `not_supported` (422) — операция объявлена в контракте, но недоступна в текущем релизе.

## Продукты

Группа операций для работы с продуктами карт: каталог доступных для выпуска типов карт и продукты, сконфигурированные самим тенантом. Код продукта (`code`) из этих ответов передаётся при выпуске карты в поле `productCode` (`POST /cards`). Цены в каталоге не приводятся — тариф получают отдельно через `GET /account/pricing?productCode=…` и `GET /tariffs/quote`.

### `GET /cards/products`
Возвращает каталог типов карт, доступных для выпуска. Используйте `code` из ответа как `productCode` при создании карты. **Требуемый scope:** `cards:read`.

- **Path/Query параметры** — нет.

- **Ответ** — `200`. Список ограничен сервером и не разбит на страницы курсором — объект `pagination` не возвращается.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      { "code": "vusa", "name": "Virtual USD Visa", "scheme": "visa", "currency": "USD", "maxCardsPerCardholder": 5 },
      { "code": "mm-cards", "name": "Virtual USD Mastercard", "scheme": "mastercard", "currency": "USD", "maxCardsPerCardholder": 5 }
    ]
  },
  "meta": { "requestId": "req_01J9X2K7M3QF8YV4N0P6T1ABCS", "timestamp": "2026-07-01T12:34:56Z" }
}
```

Каждый элемент содержит `code`, `name`, `scheme`, `currency` и `maxCardsPerCardholder` (может быть `null` — тогда действует общий лимит из `capabilities`), а также `providerSettings` — read-only шаблон настроек продукта (3DS, TTL, шаблон лимитов, Apple/Google Pay и т.п.), который применяется автоматически и не передаётся при выпуске. Массив возвращается всегда (может быть пустым); набор ключей со временем расширяется.

> **Зачем это нужно для `POST /products`.** `providerSettings` — единственный машинный способ узнать **до** создания продукта, доступны ли для схемы Apple/Google Pay. Возьмите элемент нужной схемы и проверьте ключ `apple_pay` (или `google_pay`) со значением `true` — только тогда одноимённую функцию можно включить в `POST /products`, иначе запрос будет отклонён с `422`. Сейчас эти ключи `true` у `mastercard` и `false`/отсутствуют у `visa`.

Пример элемента с `providerSettings`:

```json
{
  "code": "mm-cards",
  "name": "Virtual USD Mastercard",
  "scheme": "mastercard",
  "currency": "USD",
  "maxCardsPerCardholder": 5,
  "providerSettings": [
    { "key": "three_ds", "type": "bool", "value": true },
    { "key": "apple_pay", "type": "bool", "value": true },
    { "key": "google_pay", "type": "bool", "value": true },
    { "key": "card_ttl_months", "type": "number", "value": 36 }
  ]
}
```

- **Частые ошибки**:
  - `auth.unauthorized` → ключ невалиден, отозван, либо аккаунт приостановлен (`401`).
  - `auth.scope_denied` → у ключа нет scope `cards:read` (`403`).
  - `rate_limit.exceeded` → превышен лимит запросов (`429`).

---

### `GET /products`
Возвращает продукты, сконфигурированные и созданные тенантом; они действуют только для его карт. **Требуемый scope:** `cards:read`.

- **Query-параметры**: `provider` (опц) — фильтр по программе (алиас `core-{id}`). Опущен → программа тенанта по умолчанию. Неизвестный код → `422 request.validation_failed`.

- **Ответ** — `200`. Список ограничен сервером и не разбит на страницы курсором — объект `pagination` не возвращается.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "code": "my-usd-visa-6568124d",
        "name": "My USD Visa",
        "scheme": "visa",
        "cardType": "CONSUMER",
        "currency": "USD",
        "maxCardsPerCardholder": 3,
        "features": { "has3DS": true, "hasSpendControl": true },
        "controls": { "isReloadable": true, "spendingLimit": 500, "spendingPeriod": "MONTHLY" }
      }
    ]
  }
}
```

Поля элемента: `code`, `name`, `scheme`, `cardType` (`CONSUMER` | `CORPORATE`, может быть `null`), `currency`, `maxCardsPerCardholder`, а также блоки `features` и `controls`.

> **Здесь нет `providerCode`.** В элементах списка поле `providerCode` **не возвращается** — оно приходит только в ответе `POST /products`. Асимметрия намеренная; не рассчитывайте получить программу продукта из этого списка.

> **Регистр `scheme`.** В ответах `scheme` приходит в **нижнем** регистре (`visa` / `mastercard`), тогда как в теле `POST /products` он передаётся в **верхнем** (`VISA` / `MASTERCARD`). Сравнивайте регистронезависимо.

- **Частые ошибки**:
  - `auth.unauthorized` → ключ невалиден, отозван, либо аккаунт приостановлен (`401`).
  - `auth.scope_denied` → у ключа нет scope `cards:read` (`403`).
  - `rate_limit.exceeded` → превышен лимит запросов (`429`).

---

### `POST /products`
Создаёт продукт по конфигурации тенанта: платёжная схема, тип, набор функций и ограничения. Указанные ограничения применяются к картам этого продукта принудительно. **Требуемый scope:** `cards:write`. Заголовок `Idempotency-Key` обязателен. Операция изменяет каталог продуктов в боевой среде. Поле `hasJIT` сервером игнорируется (всегда `false`: авторизация с мастер-баланса не допускается).

- **Тело запроса** — список **закрытый**: любое поле вне этого перечня → `422 request.validation_failed` (имя поля в `error.fields`). Поле `code` **не принимается**: код продукта генерирует сервер.
  - `name` (string, обяз) — название, до 64 символов.
  - `scheme` (string, обяз) — платёжная схема: `VISA` | `MASTERCARD`.
  - `providerCode` (string, опц) — код программы в формате `core-{id}`; по умолчанию единственная настроенная программа. Неизвестный код → `422 request.validation_failed`.
  - `cardType` (string, опц) — `CONSUMER` | `CORPORATE`, по умолчанию `CONSUMER`.
  - `features` (object, опц) — набор возможностей: `has3DS`, `hasApplePay`, `hasGooglePay`, `hasSpendControl`, `hasMccControl`. **`hasApplePay` / `hasGooglePay` доступны не для всех схем** — см. врезку ниже. Поле `hasJIT` принимается, но игнорируется (всегда `false`).
  - `controls` (object, опц) — ограничения: `isReloadable` / `isOneTimeUse` (взаимоисключающи), `cardTTLMonths` (1..120), `maxCardsPerCardholder`, `spendingLimit` (0..1000000), `spendingPeriod` (`TRANSAMOUNT` | `DAILY` | `WEEKLY` | `MONTHLY` | `QUARTERLY` | `YEARLY` | `LIFETIME`).
  - `maxCardsPerCardholder` (integer, опц) — если задан, перекрывает `controls.maxCardsPerCardholder`.

> **⚠️ Apple Pay / Google Pay зависят от платёжной схемы.** Включить `hasApplePay` / `hasGooglePay` можно, только если базовый продукт выбранной схемы поддерживает соответствующую настройку. **Сейчас они доступны только для `MASTERCARD`; для `VISA` — недоступны.** Попытка включить недоступную функцию отклоняется:
> `422 request.validation_failed`, `message: "Apple Pay is not available for VISA"` (аналогично `"Google Pay is not available for VISA"`).
>
> Проверяйте доступность **заранее** через `GET /cards/products`: у базового продукта нужной схемы в `providerSettings` должен быть ключ `apple_pay` (или `google_pay`) со значением `true`.

> **Потолок продуктов.** На тенанта действует лимит **100 активных** клиент-продуктов (суммарно по всем схемам, не по каждой отдельно). При достижении → `422 request.validation_failed`, `message: "active client-product limit reached (100)"`.
>
> Слот освобождается архивированием (`DELETE /products/{code}`), **но архивировать можно только продукт без живых карт** (`active` / `frozen` / `suspended`). Продукт с выпущенными картами занимает слот до тех пор, пока все его карты не закрыты. Планируйте потолок заранее — «просто заархивировать лишнее» под завязку не получится.

```json
{
  "name": "My USD Visa",
  "providerCode": "core-1",
  "scheme": "VISA",
  "cardType": "CONSUMER",
  "features": { "has3DS": true, "hasSpendControl": true },
  "controls": { "isReloadable": true, "spendingLimit": 500, "spendingPeriod": "MONTHLY" },
  "maxCardsPerCardholder": 3
}
```

- **Ответ** — `201`. В `data` возвращается созданный продукт (структура как в `GET /products`). Поле `code` **сгенерировано сервером** (слаг от `name` + детерминированный суффикс от `Idempotency-Key`) — именно его передавайте далее в `POST /cards`. `scheme` приходит в нижнем регистре.

```json
{
  "success": true,
  "status": 201,
  "message": "Created",
  "data": {
    "code": "my-usd-visa-6568124d",
    "name": "My USD Visa",
    "scheme": "visa",
    "providerCode": "core-1",
    "cardType": "CONSUMER",
    "currency": "USD",
    "maxCardsPerCardholder": 3,
    "features": { "has3DS": true, "hasSpendControl": true },
    "controls": { "isReloadable": true, "spendingLimit": 500, "spendingPeriod": "MONTHLY" }
  }
}
```

- **Частые ошибки**:
  - `request.idempotency_key_required` → не передан заголовок `Idempotency-Key` (`400`).
  - `request.validation_failed` (`422`) → тело или конфигурация отклонены. **Все** бизнес-отказы приходят под этим одним кодом, поэтому ветвления только по `error.code` здесь недостаточно:
    - **Ошибки формата тела** (неизвестное поле, неверный `providerCode`, нарушенный диапазон) → в `error.fields` придут пофолейные сообщения.
    - **Отказы по конфигурации** → детализации по полям в `error.fields` нет ни в каком виде. Причину несёт `error.message`. При этом само поле `error.fields` ведёт себя по-разному: для отказов «функция недоступна для схемы» и «потолок продуктов» приходит бессодержательный маркер `{"configuration": ["request.validation_failed"]}`, а при отказе с сообщением `Product configuration was rejected` поля `error.fields` в ответе **нет вовсе**. Не полагайтесь на него — различайте по `error.message`:

      | `error.message` | Причина | Что делать |
      |---|---|---|
      | `Apple Pay is not available for VISA` (или `Google Pay …`) | функция недоступна для выбранной схемы | выбрать `MASTERCARD` либо отключить функцию |
      | `active client-product limit reached (100)` | достигнут потолок активных продуктов | архивировать неиспользуемые (`DELETE /products/{code}`) — только те, у которых не осталось живых карт |
      | `Product configuration was rejected` | конфигурация отклонена | повтор с тем же ключом не поможет — измените конфигурацию и возьмите **новый** `Idempotency-Key` |
  - `auth.scope_denied` → у ключа нет scope `cards:write` (`403`).
  - `idempotency.in_progress` / `idempotency.key_conflict` → повтор с тем же ключом уже выполняется, либо ключ переиспользован с другим телом (`409`).
  - `rate_limit.exceeded` → превышен лимит запросов (`429`).
  - `service.unavailable` (`503`) → сервис временно недоступен. Для этой ручки **не** повторяйте вслепую с тем же ключом: при неопределённом исходе ключ может остаться занятым. Сначала проверьте `GET /products` — не создан ли продукт; если нет, повторяйте с **новым** ключом.

---

### `DELETE /products/{code}`
Архивирует клиент-продукт: удаляет продукт и деактивирует запись — выпуск новых карт по нему становится недоступен. **Требуемый scope:** `cards:write`. Заголовок `Idempotency-Key` обязателен. Операция изменяет каталог продуктов в боевой среде.

> **⚠️ Только продукт без живых карт.** Архивировать можно только продукт, по которому не осталось ни одной карты в состоянии `active` / `frozen` / `suspended`. Если такие карты есть, архивация **отклоняется**. Порядок действий: закройте все карты продукта (`DELETE /cards/{cardId}`), затем архивируйте.
>
> Отказ приходит как `422 request.validation_failed` с generic-сообщением `"Could not archive product"` — **точное число живых карт наружу не передаётся**, отдельного кода для этого случая нет.

- **Path/Query параметры**:
  - `code` (string, обяз) — код архивируемого клиент-продукта (из ответа `POST /products`). Код, не совпадающий с `^[a-z0-9][a-z0-9_-]{1,63}$`, трактуется как несуществующий → `404`.

- **Ответ** — `200`. В `data` возвращается подтверждение: код продукта и признак архивации.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "code": "my-usd-visa-6568124d", "archived": true },
  "meta": { "requestId": "req_01J9X2K7M3QF8YV4N0P6T1ABCS", "timestamp": "2026-07-01T12:34:56Z" }
}
```

- **Частые ошибки**:
  - `request.idempotency_key_required` → не передан заголовок `Idempotency-Key` (`400`).
  - `product.not_found` → продукт не существует, принадлежит другому аккаунту/окружению, либо `code` синтаксически некорректен (`404`).
  - `request.validation_failed` → архивация отклонена по иной причине; сообщение generic (`"Could not archive product"`), детализации в `error.fields` нет (`422`).
  - `auth.scope_denied` → у ключа нет scope `cards:write` (`403`).
  - `idempotency.in_progress` / `idempotency.key_conflict` → повтор с тем же ключом уже выполняется, либо ключ переиспользован с другим телом (`409`).
  - `rate_limit.exceeded` → превышен лимит запросов (`429`).

## Заказы (Orders)

Ордер (order) — это способ узнать исход асинхронной денежной операции (выпуск карты, пополнение, вывод). Такие операции сразу возвращают `202` с `orderId`, а фактический результат приходит позже. Чтобы получить исход, клиент либо поллит ордер по `orderId`, либо дожидается вебхука.

### `GET /orders/{orderId}`
Возвращает текущее состояние ордера асинхронной операции. Пока операция выполняется — ответ `202` (`status=processing`); при достижении терминального состояния — `200`. Терминальное состояние наступает не позднее чем через 15 минут: если исход не подтверждён, ордер завершится статусом `refunded` или `failed` с полем `failureCode`, а средства автоматически вернутся на баланс кошелька. **Требуемый scope:** `cards:read` — учтите, что `cards:write` его **не** покрывает: интеграции, которые выпускают карты и поллят исход, должны иметь оба scope.

- **Path-параметры**
  - `orderId` (string, обяз.) — идентификатор ордера. Чужой или несуществующий ордер → `404 order.not_found` (единый ответ обеспечивает изоляцию аккаунтов).

**Статусы ордера (`status`):**
- `processing` — операция ещё выполняется (ответ `202`, `completedAt=null`).
- `completed` — успешный терминальный статус (`200`).
- `failed` — терминальный, списания не было; заполнен `failureCode` (`200`).
- `refunded` — терминальный, списание скомпенсировано и средства возвращены на кошелёк; заполнен `failureCode` (`200`).

Тип ордера (`type`): `issue`, `fund`, `unload` (типа `close` нет — закрытие карты с ненулевым остатком создаёт ордер типа `unload`).

- **Ответ**

`202` — ордер ещё выполняется (тот же объект, `status=processing`, `completedAt=null`).

`200` — терминальное состояние:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "orderId": "9f3c1a2b-0000-4000-8000-000000000006",
    "type": "fund",
    "status": "completed",
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "cardholderId": "3c1d2e3f-0000-4000-8000-000000000010",
    "amountMinor": 10000,
    "feeMinor": 250,
    "unloadedMinor": null,
    "creditedMinor": null,
    "currency": "USD",
    "scale": 2,
    "externalReference": "fund-001",
    "failureCode": null,
    "createdAt": "2026-07-01T12:00:00Z",
    "completedAt": "2026-07-01T12:00:04Z"
  }
}
```

Поля денежных сумм — целые числа в минимальных (minor) единицах, интерпретируются по паре `currency` + `scale` (в примере USD, scale=2 → `10000` = 100.00 USD; `250` = 2.50 USD). Пояснения к полям:
- `amountMinor` — запрошенная сумма (нетто для `issue`/`fund`, брутто для `unload`).
- `feeMinor` — комиссия (в терминальном статусе — фактическая).
- `unloadedMinor` — только для `type=unload`: фактически снятая с карты сумма (в остальных случаях `null`).
- `creditedMinor` — только для `type=unload`: зачислено на кошелёк (в остальных случаях `null`).
- `cardId` — может быть `null` для `issue` до момента создания карты.
- `failureCode` — заполняется при `status=failed`/`refunded`; иначе `null`. Возможные значения: `card_state_invalid`, `insufficient_card_balance`, `wallet_insufficient_balance`, `provider_rejected`, `temporarily_unavailable`, `internal_timeout`, `limit_exceeded`, `internal_error`.

- **Частые ошибки**
  - `order.not_found` — ордер не существует либо принадлежит другому аккаунту/окружению (`404`).

## Вебхуки — конфигурация и доставки

Группа эндпоинтов для управления единственным webhook-endpoint аккаунта и просмотра журнала доставок. Окружение одно (боевое): на аккаунт настраивается **ровно один** активный endpoint со своей конфигурацией и своим секретом. `PUT /webhooks` с другим `url` создаёт новый endpoint и автоматически выключает прежний (`status=disabled`) — веерная доставка на несколько URL не поддерживается.

Требуемые scope: `webhooks:read` — для `GET /webhooks` и `GET /webhooks/deliveries`; `webhooks:write` — для `PUT /webhooks`, `DELETE /webhooks/{webhookId}`, `POST /webhooks/regenerate-secret`, `POST /webhooks/test`. Запрос вне scope → `403 auth.scope_denied`. Расширяющего покрытия (subsumption) между `webhooks:write` и `webhooks:read` **нет** — выдавайте оба, если нужны и чтение, и запись.

### `GET /webhooks`

Возвращает текущую конфигурацию webhook-endpoint. Если endpoint ещё не сконфигурирован, отвечает 404 с кодом `webhook.not_configured`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "id": "3f2a1b4c-0000-4000-8000-000000000001",
    "url": "https://client.example/caas-webhook",
    "status": "active",
    "events": ["card.*", "cardholder.*"],
    "signatureMode": "caas_v1",
    "secretFingerprint": "a1b2c3d4",
    "consecutiveFailures": 0,
    "lastSuccessAt": "2026-07-01T12:00:00Z",
    "lastFailureAt": null,
    "createdAt": "2026-06-01T00:00:00Z",
    "updatedAt": "2026-07-01T00:00:00Z"
  }
}
```

Поля конфигурации:
- `id` — публичный идентификатор endpoint; передаётся в `DELETE /webhooks/{webhookId}`.
- `status` — `active` или `disabled`; `disabled` означает, что endpoint выключен (автоматически после серии неудач или вручную), и события в этот период получают статус доставки `skipped`.
- `events` — точные типы событий и/или glob-шаблоны (`card.*`, `*`). Шаблоны сопоставляются только с опубликованным каталогом событий; `*` не включает чувствительные категории.
- `signatureMode` — `caas_v1` или `data_sign_compat` (режим совместимости для миграции).
- `secretFingerprint` — первые 8 hex-символов отпечатка секрета, только для визуальной идентификации; не пригоден для проверки подписи.
- `consecutiveFailures`, `lastSuccessAt`, `lastFailureAt` — телеметрия доставок.

- **Частые ошибки**:
  - `webhook.not_configured` (404) — endpoint для окружения ещё не создан.
  - `auth.unauthorized` (401) — ключ невалиден/отозван или аккаунт приостановлен.

### `PUT /webhooks`

Создаёт или обновляет webhook-endpoint (upsert). Операция идемпотентна по своей природе, заголовок `Idempotency-Key` необязателен. Обновление реактивирует endpoint (`status=active`, `consecutiveFailures=0`).

- **Тело запроса**:
  - `url` (string, обяз.) — только `https` на порту `:443`. Хост должен быть публично доступен. Запрещены: приватные, loopback, link-local и metadata-адреса, IP-литералы, а также userinfo и фрагменты в URL (защита от SSRF). При доставке редиректы не выполняются. Исключений для sandbox-хостов нет — окружение одно, боевое.
  - `events` (array, обяз., минимум 1 элемент) — точные типы событий и/или glob-шаблоны (`card.*`, `*`).
  - `signatureMode` (string, опц.) — `caas_v1` (по умолчанию) или `data_sign_compat`.

```json
{
  "url": "https://client.example/caas-webhook",
  "events": ["card.*", "cardholder.*"],
  "signatureMode": "caas_v1"
}
```

- **Ответ** — `200`. При ПЕРВОМ создании ответ дополнительно содержит поле `data.secret` (формат `whsec_` и 64 hex-символа). Секрет показывается только один раз — сохраните его. При последующих обновлениях поле `secret` не возвращается.

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "id": "3f2a1b4c-0000-4000-8000-000000000001",
    "url": "https://client.example/caas-webhook",
    "status": "active",
    "events": ["card.*", "cardholder.*"],
    "signatureMode": "caas_v1",
    "secret": "whsec_3f9c...abc",
    "secretFingerprint": "a1b2c3d4",
    "consecutiveFailures": 0,
    "lastSuccessAt": null,
    "lastFailureAt": null,
    "createdAt": "2026-06-01T00:00:00Z",
    "updatedAt": "2026-07-01T00:00:00Z"
  }
}
```

- **Частые ошибки**:
  - `webhook.url_not_allowed` (422) — URL отсутствует, пуст либо не проходит проверку (не https/не :443, приватный/loopback/metadata-хост, IP-литерал, userinfo или фрагмент); конкретная причина — в `error.fields.url`.
  - `request.validation_failed` (422) — некорректные поля тела (подробности в `error.fields`).
  - `request.malformed` (400) — некорректное тело запроса.

### `DELETE /webhooks/{webhookId}`

Удаляет webhook-endpoint по его идентификатору.

- **Path-параметры**:
  - `webhookId` (string uuid, обяз.) — публичный идентификатор endpoint (поле `id` из конфигурации).

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "deleted": true }
}
```

- **Частые ошибки**:
  - `webhook.not_configured` (404) — endpoint не существует либо принадлежит другому аккаунту/окружению (единый 404 для изоляции).

### `POST /webhooks/regenerate-secret`

Ротация webhook-секрета. Ограничение частоты: не чаще 1 запроса в минуту. Новый секрет показывается один раз. Действует окно совмещения 24 часа: новые доставки уже подписываются НОВЫМ секретом, а прежний остаётся действительным для проверки подписи до `oldSecretValidUntil`.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "secret": "whsec_3f9c...abc",
    "rotatedAt": "2026-07-01T12:00:00Z",
    "oldSecretValidUntil": "2026-07-02T12:00:00Z"
  }
}
```

- **Частые ошибки**:
  - `webhook.not_configured` (404) — endpoint ещё не создан.
  - `rate_limit.exceeded` (429) — превышен лимит частоты (повторяйте не раньше `Retry-After`).

### `POST /webhooks/test`

Отправляет на ваш endpoint полноценно подписанное тестовое событие с полем `data.test: true`. Ограничение частоты: не чаще 5 запросов в минуту. В ответе возвращается только булев признак доставки.

- **Тело запроса** (необязательно):
  - `event` (string, опц.) — тип события из каталога; по умолчанию `webhook.test`. Для выбранного типа собирается реалистичный sample-payload по нормативной схеме, чтобы вы могли протестировать свой обработчик против реальной формы данных. **Неизвестный или неопубликованный тип ошибкой не считается** — вместо него доставляется `webhook.test` (fallback), ответ `200`.

```json
{ "event": "card.funded" }
```

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": { "delivered": true }
}
```

- **Частые ошибки**:
  - `webhook.not_configured` (404) — endpoint ещё не создан.
  - `rate_limit.exceeded` (429) — превышен лимит частоты.

### `GET /webhooks/deliveries`

Журнал доставок вебхуков (курсорная пагинация — см. общий раздел). Срок хранения записей: успешно доставленные — не менее 30 дней, неудачные и окончательно отклонённые — не менее 90 дней. Поле `deliveryId` совпадает с `eventId` конверта доставки (используйте его для дедупликации на своей стороне).

- **Query-параметры**:
  - `limit` (int, опц.) — размер страницы.
  - `cursor` (string, опц.) — курсор следующей страницы.
  - `status` (string, опц.) — фильтр по статусу доставки: `pending`, `retrying`, `delivered`, `failed`, `dead`, `skipped`. Значение вне перечня ошибкой не считается — вернётся пустая страница.
  - `event` (string, опц.) — фильтр по типу события. Значение вне каталога ошибкой не считается — вернётся пустая страница.
  - `from` (string date-time, опц.) — нижняя граница диапазона.
  - `to` (string date-time, опц.) — верхняя граница диапазона.

- **Ответ** — `200`:

```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": {
    "items": [
      {
        "deliveryId": "c1d2e3f4-0000-4000-8000-000000000009",
        "event": "card.funded",
        "status": "delivered",
        "attempts": 1,
        "lastHttpCode": 200,
        "lastError": null,
        "nextRetryAt": null,
        "deliveredAt": "2026-07-01T12:00:05Z",
        "createdAt": "2026-07-01T12:00:04Z"
      }
    ],
    "pagination": { "limit": 20, "nextCursor": null, "hasMore": false }
  }
}
```

Поля записи: `attempts` — число попыток; `lastHttpCode` — код последнего ответа (или `null`); `lastError` — класс ошибки (`timeout`, `dns`, `5xx`, `redirect_blocked`, `ssrf_blocked`, …); `nextRetryAt` — время следующей повторной попытки (или `null`).

- **Частые ошибки**:
  - `request.malformed` (400) — некорректный `cursor` либо `from`/`to` не в формате RFC 3339.
  - `auth.unauthorized` (401) — ключ невалиден/отозван или аккаунт приостановлен.

## Вебхуки: приём событий

Настройте endpoint через `PUT /webhooks` (см. раздел «Вебхуки — конфигурация»), и платформа будет присылать `POST`-запросы с событиями (выпуск карты, пополнение, отклонения и т.д.). Каждое событие завёрнуто в конверт:

```json
{
  "event": "card.funded",
  "version": "1.0",
  "eventId": "b6c7d8e9-f0a1-4b2c-9d4e-6f708192a3b4",
  "data": { "cardId": "…", "orderId": "…", "amountMinor": 5000, "currency": "USD", "scale": 2, "occurredAt": "2026-07-01T12:05:00Z" }
}
```

Сопутствующие заголовки: `X-Caas-Signature` (подпись), `X-Caas-Event` (тип), `X-Caas-Event-Id` (id для дедупликации), `X-Caas-Delivery` (id попытки доставки). У тест-доставок (`POST /webhooks/test`) дополнительно приходит `X-Caas-Test: 1`, дублирующий `data.test: true`, а `eventId` имеет префикс `test-` (не UUID) — гейтите бизнес-обработку по любому из этих признаков и не проводите по тестам деньги/статусы.

### Проверка подписи (обязательно)

В заголовке `X-Caas-Signature` приходит строка:

```
X-Caas-Signature: t=1719830400,v1=3ba9f1e0c8b7...
```

где `t` — Unix-время отправки (секунды), `v1` — hex-подпись HMAC-SHA256. Проверяйте так (**ровно в этом порядке**):

1. Возьмите **сырое** тело запроса как есть, до любого парсинга (`rawBody`, байты).
2. Разберите заголовок на `t` и `v1`.
3. Выведите ключ подписи из вашего webhook-секрета:
   `signingKey = hex(SHA256(webhookSecret))` — **64-символьная hex-строка** в нижнем регистре, НЕ сырые байты.
4. Составьте подписываемое сообщение: `signedPayload = t + "." + rawBody`.
5. Посчитайте ожидаемую подпись: `expected = hex(HMAC_SHA256(key = signingKey, message = signedPayload))`.
6. Сравните `expected` с `v1` в **constant-time**. Не совпало → отклоните (`400`/`401`).
7. Проверьте свежесть: `|текущее_время − t| ≤ 300` секунд, иначе отклоните (защита от replay).

> Ключевой момент: ключ HMAC — это **не сам секрет**, а его hex-SHA-256 (строка из 64 символов). Подписывается `t + "." + тело`.

**Python:**

```python
import hashlib, hmac, time

def verify(secret: str, signature_header: str, raw_body: bytes) -> bool:
    parts = dict(p.split("=", 1) for p in signature_header.split(","))
    t, v1 = parts["t"], parts["v1"]
    if abs(time.time() - int(t)) > 300:
        return False
    signing_key = hashlib.sha256(secret.encode()).hexdigest()   # hex-строка!
    signed = t.encode() + b"." + raw_body
    expected = hmac.new(signing_key.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
```

**Node.js:**

```js
const crypto = require("crypto");

function verify(secret, signatureHeader, rawBody /* Buffer */) {
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const { t, v1 } = parts;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const signingKey = crypto.createHash("sha256").update(secret).digest("hex"); // hex-строка
  const signed = Buffer.concat([Buffer.from(t + "."), rawBody]);
  const expected = crypto.createHmac("sha256", signingKey).update(signed).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

### Обработка доставок

- **Дедупликация:** доставка гарантирует «не менее одного раза» — одно и то же событие может прийти повторно. Дедуплицируйте по `eventId`.
- **Порядок не гарантирован:** стройте state-машину по полю `data.occurredAt` и статусам, а не по факту прихода.
- **Быстрый ответ:** обработайте и верните код **2xx в течение 8 секунд**. Тяжёлую работу выносите в фон.
- **Повторы:** при таймауте или кодах `408/429/5xx` доставка повторяется по расписанию: сразу, затем `+30s`, `+2m`, `+10m`, `+1h`, `+3h`, `+6h` (до 7 попыток, ~22 часа, с джиттером). Прочие `4xx` считаются терминальным отказом (доставка помечается `failed`).
- **Деньги:** денежные события эмитятся ПОСЛЕ фактической финализации средств — суммам в них можно доверять.
- Тест доставки — `POST /webhooks/test`; журнал попыток — `GET /webhooks/deliveries`.

### Каталог событий

| Событие | Когда приходит | Ключевые поля `data` |
|---|---|---|
| `card.created` | карта успешно выпущена | `cardId`, `orderId`, `status`, `last4`, `expMonth`, `expYear` |
| `card.failed` | выпуск не удался (средства возвращены) | `orderId`, `failureCode` |
| `card.funded` | пополнение завершено | `cardId`, `orderId`, `amountMinor`, `currency`, `scale` |
| `card.funding_failed` | пополнение не удалось | `cardId`, `orderId`, `failureCode` |
| `card.unloaded` | вывод с карты завершён (в т.ч. остаток при закрытии) | `cardId`, `orderId`, `amountMinor` |
| `card.unloading_failed` | вывод не удался | `cardId`, `orderId`, `failureCode` |
| `card.frozen` | карта заморожена (вами или платформой) | `cardId`, `status`, `reason` |
| `card.unfrozen` | карта разморожена | `cardId`, `status` |
| `card.suspended` | карта автоматически заблокирована платформой (снимается пополнением) | `cardId`, `status` |
| `card.closed` | карта закрыта (может нести остаток) | `cardId`, `residualAmountMinor`, `residualCreditedMinor` |
| `card.expired` | истёк срок действия карты | `cardId`, `status` |
| `card.tariff_plan_assigned` | карте назначен тарифный план | `cardId`, `planCode` |
| `card.transaction.settled` | покупка списана (clearing) | `cardId`, `cardholderId`, поля транзакции, `informational` |
| `card.transaction.declined` | транзакция отклонена | то же + `declineCode` |
| `card.transaction.reversed` | авторизация отменена | то же, что у `settled` |
| `card.transaction.refunded` | возврат от мерчанта | то же, что у `settled` |
| `card.transaction.fee` | комиссия по транзакции | то же + `feeType` |
| `card.3ds_otp` | 3DS-код для подтверждения оплаты (только при `threeDsOtpRelay=webhook`) — **sensitive** | `cardId`, `type`, `code`, `last4`, `context` |
| `card.tokenization_otp` | код токенизации (Apple/Google Pay, только при `threeDsOtpRelay=webhook`) — **sensitive** | `cardId`, `type`, `code`, `last4` |
| `cardholder.created` | создан держатель | `cardholderId`, `externalRef`, `status` |
| `cardholder.status_changed` | изменился статус держателя | `cardholderId`, `status` |
| `cardholder.kyc_approved` | KYC держателя принят | `cardholderId`, `kycStatus` |
| `cardholder.kyc_rejected` | KYC держателя отклонён | `cardholderId`, `kycStatus` |
| `cardholder.tariff_plan_assigned` | держателю назначен тарифный план | `cardholderId`, `planCode` |
| `account.deposit_credited` | средства зачислены на баланс кошелька; идемпотентно по `networkTxId` | `amountMinor`, `currency`, `scale`, `networkTxId` |
| `webhook.test` | тестовая доставка (по `POST /webhooks/test`) | `test`, `message`, `occurredAt` |

**События `card.transaction.*`.** Тип выбирается по исходу транзакции, а `data` у всех пяти единая и **плоская** (не вложенный объект): поля транзакции той же формы, что в `GET /cards/{cardId}/transactions` (`id`, `type`, `status`, `amountMinor`, `currency`, `scale`, `feeMinor`, `merchantName`, `mcc`, `declineCode`, `feeType`, `authorizationCode`, `relatedAuthorizationCode`, `occurredAt`), плюс `cardId`, `cardholderId` и `informational: true`. Поле `feeMinor` — итоговая комиссия одним числом. Эти события **информационные** — деньги по ним не проводите, баланс сверяйте через `GET /cards/{cardId}/balance`.

Подписка на события задаётся в `PUT /webhooks` полем `events` — точные типы и/или glob-шаблоны (`card.*`, `*`). Glob `card.*` и `*` включают **все** опубликованные `card.*`-события, в том числе `card.transaction.*` и OTP-события (`card.3ds_otp`, `card.tokenization_otp`), если аккаунт настроен на `threeDsOtpRelay=webhook`.

### OTP-события (3DS / токенизация) — SENSITIVE

При `threeDsOtpRelay=webhook` одноразовые коды приходят вебхуками: `card.3ds_otp` (подтверждение оплаты по 3-D Secure) и `card.tokenization_otp` (добавление карты в Apple/Google Pay). Поле `data.code` содержит сам код — доставьте его держателю **немедленно** (SMS/email/push). Код действителен ограниченное время (~5 минут).

Пример тела:

```json
{
  "event": "card.3ds_otp",
  "version": "1.0",
  "eventId": "e3f4a5b6-c7d8-4e9f-8a1b-3c4d5e6f70a1",
  "data": {
    "cardId": "8f2d840e-c05d-418f-9845-9a057b1fcab5",
    "type": "3ds",
    "code": "654321",
    "last4": "4242",
    "context": { "amount": 12.5, "currency": "USD", "merchant": "STARBUCKS #1234" },
    "occurredAt": "2026-07-11T15:43:03Z"
  }
}
```

Требования безопасности к приёму OTP: endpoint строго **HTTPS**; обязательная проверка подписи `X-Caas-Signature`; код **не логировать** и не хранить дольше необходимого для доставки; отвечать `2xx` быстро. `card.tokenization_otp` — тот же формат, `data.type` = `tokenization`.

---

## Справочник кодов ошибок

Ветвите логику по `error.code` (не по HTTP-статусу и не по `message`). Набор открытый — предусмотрите обработку незнакомых значений.

**Запрос / валидация**

| Код | HTTP | Когда |
|---|---|---|
| `request.malformed` | 400 | тело не является валидным JSON-объектом |
| `request.validation_failed` | 422 | поле не прошло валидацию (детали в `error.fields`) |
| `request.idempotency_key_required` | 400 | не передан обязательный `Idempotency-Key` |

**Аутентификация и доступ**

| Код | HTTP | Когда |
|---|---|---|
| `auth.unauthorized` | 401 | нет / битый / просроченный / отозванный ключ |
| `auth.scope_denied` | 403 | ключу не хватает права (`error.details.requiredScope`) |
| `secure.disabled` | 403 | secure-режим (реквизиты карты) для аккаунта не включён |

**Не найдено (изоляция аккаунта)**

| Код | HTTP | Когда |
|---|---|---|
| `card.not_found` · `cardholder.not_found` · `order.not_found` · `product.not_found` · `webhook.not_configured` | 404 | ресурс не существует или принадлежит другому аккаунту |

**Идемпотентность**

| Код | HTTP | Когда |
|---|---|---|
| `idempotency.in_progress` | 409 | запрос с этим ключом ещё выполняется |
| `idempotency.key_conflict` | 409 | тот же ключ с другим телом/путём |
| `operation.duplicate_reference` | 409 | повтор по бизнес-референсу операции |

**Состояние карты / держателя**

| Код | Когда |
|---|---|
| `card.invalid_state` | операция недопустима в текущем статусе карты |
| `card.frozen` | карта заморожена |
| `card.not_revealable` | реквизиты недоступны для этой карты |
| `card.too_new_to_close` · `card.lifecycle_cooldown` | закрытие/операция слишком рано после предыдущего действия |
| `cardholder.has_active_cards` | нельзя деактивировать держателя с активными картами |
| `cardholder.not_eligible` | держатель не может получить карту (статус/условия) |
| `operation.pending_reconciliation` | предыдущая операция ещё сверяется — повторите позже |

**Деньги и лимиты**

| Код | Когда |
|---|---|
| `funding.below_minimum` | сумма меньше минимальной (`capabilities.limits`) |
| `amount.exceeds_maximum` | сумма больше максимальной |
| `card.insufficient_balance` | на карте недостаточно средств для вывода |
| `wallet.insufficient_balance` | на кошельке недостаточно средств для операции |
| `rate_limit.exceeded` (429) | превышена частота запросов |
| `quota.exceeded` (429) | исчерпана квота аккаунта |

**Продукты и тарифы**

| Код | Когда |
|---|---|
| `card.product_unknown` · `product.not_found` | неизвестный `productCode` |
| `card.product_not_issuable` | по продукту нельзя выпустить карту |
| `pricing.plan_missing` · `pricing.rate_missing` | тарифный план/ставка не настроены |

**Возможности и обработка**

| Код | Когда |
|---|---|
| `not_supported` · `kyc.not_supported` | функция недоступна в текущем релизе |
| `webhook.url_not_allowed` | URL вебхука не публичный https на :443 (или содержит user-info/фрагмент) |
| `provider.declined` | операция отклонена на стороне обработки |

**Сервер**

| Код | HTTP | Когда |
|---|---|---|
| `internal.error` | 500 | внутренняя ошибка |
| `service.unavailable` | 503 | сервис временно недоступен — повторите с тем же ключом (для денежных write вместо 503 обычно приходит `202 Accepted`) |

---

## Справочник статусов и enum

Статус-модели **закрытые** (перечень фиксирован). Открытые наборы (коды ошибок, схемы карт, статьи комиссий) могут пополняться — обрабатывайте незнакомые значения по умолчанию.

| Enum | Значения |
|---|---|
| **Статус карты** (`CardStatus`) | `issuing`, `active`, `frozen`, `suspended`, `closed`, `expired` |
| **Статус заказа** (`OrderStatus`) | `processing`, `completed`, `failed`, `refunded` |
| **Тип заказа** (`OrderType`) | `issue`, `fund`, `unload` |
| **Статус держателя** (`CardholderStatus`) | `active`, `inactive`, `suspended` |
| **Статус KYC** (`KycStatus`) | `unsubmitted`, `submitted`, `accepted`, `rejected`, `waived` |
| **Тип транзакции карты** (`CardTransactionType`) | `authorization`, `settlement`, `fee`, `refund`, `reversal` |
| **Статус транзакции карты** (`CardTransactionStatus`) | `pending`, `completed`, `declined`, `refunded`, `reversed` |
| **Тип движения кошелька** (`WalletTransactionType`) | `deposit`, `card_funding`, `card_fee`, `card_unload`, `refund`, `program_return`, `adjustment` (только в ответе — display-fallback, фильтровать по нему нельзя) |
| **Причина отклонения** (`DeclineCode`) | `insufficient_funds`, `card_inactive`, `card_frozen`, `card_suspended`, `invalid_credentials`, `three_ds_failed`, `merchant_not_allowed`, `limit_exceeded`, `suspected_fraud`, `other` |
| **Причина сбоя операции** (`FailureCode`) | `card_state_invalid`, `insufficient_card_balance`, `wallet_insufficient_balance`, `provider_rejected`, `temporarily_unavailable`, `internal_timeout`, `limit_exceeded`, `internal_error` |
| **Статья комиссии** (`FeeItem`) | `issuance`, `funding`, `unload`, `transaction`, `fx`, `maintenance`, `decline`, `chargeback`, `tokenization` |
| **Тип комиссии** (`FeeType`) | `cross_border`, `decline_domestic`, `decline_international`, `maintenance`, `other` |
| **Статус доставки вебхука** (`DeliveryStatus`) | `pending`, `retrying`, `delivered`, `failed`, `dead`, `skipped` |

---

*Документ сгенерирован из контракта `openapi.yaml`. При расхождениях источником истины считается openapi.*
