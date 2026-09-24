# Полная платформа администрирования Flytopay

## Цель

Превратить `/admin` в полноценный back-office для управления продуктом,
продажами, ценами, картами, маркетингом, коммуникациями, интеграциями и
безопасностью. Источник функциональных паттернов — административная часть
RageNet VPN; доменная модель и ограничения — реальные сущности Flytopay и
правила CaaS/платёжных интеграций.

## Принцип реализации

Каждый раздел должен быть настоящим рабочим доменом: PostgreSQL-модели и
migrations, FastAPI CRUD/аналитика, RBAC permission, CSRF/idempotency для
изменений, audit log, UI loading/error/empty states и тесты. В интерфейсе не
будет функций, которые существуют только как декоративные заглушки.

## Карта разделов

### Обзор

Продажи, платежи, средний чек, конверсия, активность пользователей, выпуск
карт, аренды, demo-карты, остатки/резервы кошельков, комиссии, маржа,
продукты, страны, источники, графики за день/неделю/месяц, ошибки, последние
операции и состояние API/DB/Redis/Celery/CaaS/Telegram.

### Продажи и финансы

- `Sales analytics`: выручка, ARPU, средний чек, conversion, retention, LTV,
  продажи по продуктам/странам/источникам/промокодам/кампаниям, когортные
  периоды, сравнение периодов, CSV export.
- `Payments`: платежи, провайдеры, назначения, статусы, комиссии, маржа,
  reconciliation cases, зависшие операции, безопасные retry и повторная
  сверка webhook.
- `Refunds`: отдельный workflow возврата с permission, reason, idempotency,
  audit и запретом произвольной корректировки ledger.

### Пользователи

Поиск, фильтры, сегменты, пагинация, карточка профиля, Telegram-связи,
активность, платежи, кошельки, карты, аренды, promo/referral attribution,
заметки, теги, блокировка, soft delete/restore, отзыв сессий, ручная demo
выдача и массовые безопасные действия.

### Карты и каталог

- `Card products`: код, название, scheme, тип, валюта, страны, enabled,
  порядок, demo/real, лимиты, provider capabilities, preview.
- `Price plans`: выпуск, аренда, сроки 1/7/30/90/180/365, custom days,
  комиссии, minimum/maximum, валюты и история версий цены.
- `Issuance`: очередь заявок, статусы, ошибки провайдера, provider order,
  retry/sync согласно асинхронному контракту CaaS.
- `Cards/Rentals/Transactions`: фильтры, сроки, freeze/unfreeze/close,
  fund/unload, лимиты, demo, связь с пользователем и платежом.

### Маркетинг

- `Campaigns`: start parameter, UTM/source/channel, период, бюджет, бонусы,
  лимит, registrations, first payments, conversion, revenue, CAC, ROI,
  архивирование и экспорт.
- `Promo codes/Groups`: процентная или фиксированная скидка, бесплатный выпуск
  или аренда, wallet bonus, сроки, usage limits, product/country/user rules,
  массовая генерация, import/export, usage/revenue analytics.
- `Referrals`: настройки комиссии, referral tree, партнёры, выплаты,
  задолженность, top referrers, anti-abuse flags.

### Коммуникации и контент

FAQ, новости, категории/tags, юридические документы, Telegram/email templates,
broadcasts с сегментацией, preview, расписание, история отправки, pinned
messages, bot menu/buttons, landing pages, banners/media и RU/EN локализация.

### Система и безопасность

- `API & Integrations`: latency/uptime/version, PostgreSQL, Redis, Celery
  worker/beat, CaaS capabilities, payment providers, Telegram, webhook health,
  failed/retry jobs, errors/correlation IDs, maintenance и feature flags.
- `Admins/Roles/Permissions`: allowlist, роли, granular permissions, revoke
  admin sessions, bootstrap owner protection.
- `Audit`: actor, action, resource, reason, IP, user-agent, correlation ID,
  immutable event view без PAN/CVV/tokens/secrets.
- `Settings`: только безопасные бизнес-настройки; секреты остаются в env/secret
  store и никогда не возвращаются в браузер.

## Доменная модель

Существующие `User`, `Session`, `Wallet`, `PaymentAttempt`, `UserCard`,
`CardProduct`, `Rental`, `IssuanceRequest`, `AdminRole`, `AdminPermission` и
`AdminAuditEvent` расширяются без дублирования. Новые домены:

- `product_prices`, `product_price_versions`, `fee_policies`;
- `sales_daily_snapshots`, `analytics_attributions`;
- `user_tags`, `user_notes`, `user_segments`;
- `campaigns`, `campaign_events`, `campaign_bonuses`;
- `promo_groups`, `promo_codes`, `promo_redemptions`;
- `referral_settings`, `referral_links`, `referral_ledger`, `payout_requests`;
- `content_documents`, `content_categories`, `content_tags`, `media_assets`;
- `message_templates`, `broadcasts`, `broadcast_deliveries`;
- `feature_flags`, `system_settings`, `integration_health_checks`;
- `admin_idempotency_keys`, `admin_jobs`, `admin_error_events`.

Все новые таблицы получают UUID, timestamps, необходимые индексы, foreign keys,
уникальные ограничения и миграции Alembic. Цены и ledger — integer minor units
с ISO currency и scale, без float.

## API-контракт

Все административные endpoints находятся под `/api/v1/admin/{domain}` и
возвращают единый envelope. Read endpoints поддерживают `q`, filters,
`page`, `limit`, `sort`, `order`, `date_from`, `date_to`. Mutations требуют:

- соответствующее granular permission;
- `verify_csrf`;
- `Idempotency-Key`;
- валидированную причину для рискованных действий;
- audit event;
- транзакционную фиксацию или безопасный async job.

Опасные финансовые и CaaS операции не считаются успешными по HTTP 202: UI
показывает `pending`, а результат берётся из orders/webhooks/reconciliation.

## RBAC permissions

Базовые permission names:

```text
admin.read
admin.users.read / admin.users.write
admin.cards.read / admin.cards.write
admin.products.read / admin.products.write
admin.prices.read / admin.prices.write
admin.sales.read / admin.payments.write / admin.refunds.write
admin.marketing.read / admin.marketing.write
admin.referrals.read / admin.referrals.write
admin.content.read / admin.content.write / admin.broadcasts.send
admin.system.read / admin.system.write
admin.roles.read / admin.roles.write
admin.audit.read
```

## Этапы

1. **Foundation:** schema conventions, migrations, permissions, UI shell,
   dashboard, sales analytics, API health, integrations, audit.
2. **Users/Cards:** user detail, segments/tags/notes, bulk actions, products,
   prices, issuance, cards, rentals, transactions.
3. **Payments:** payments, providers, commissions, reconciliation, refunds,
   financial reports and exports.
4. **Marketing:** campaigns, attribution, promo codes/groups, referrals,
   partner stats, ROI.
5. **Communications:** templates, broadcasts, FAQ/news/legal/media/landing
   content and localization.
6. **Security/Operations:** admin management, roles, settings, jobs, errors,
   feature flags, maintenance, full responsive/accessibility pass.

Каждый этап завершается отдельным working increment с migration tests, API
tests, frontend typecheck/build и focused commit. Production deployment
выполняется только после прохождения полного backend и web suites.

## Запреты

- Не отображать PAN, CVV, session tokens, provider keys, webhook secrets или
  полные cardholder PII.
- Не добавлять фиктивные sales/campaign/API metrics.
- Не проводить live card/payment operations в автоматических тестах.
- Не менять production env из web UI.
- Не выполнять финансовые mutation без permission, reason, idempotency и audit.
