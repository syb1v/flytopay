"use client";

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

export const userStatusLabels: Record<string, string> = {
  active: "Активен",
  blocked: "Заблокирован",
  deleted: "Удалён",
};

export const cardStatusLabels: Record<string, string> = {
  issuing: "Выпускается",
  active: "Активна",
  frozen: "Заморожена",
  closing: "Закрывается",
  closed: "Закрыта",
  expired: "Истекла",
  suspended: "Приостановлена",
};

export const issuanceStatusLabels: Record<string, string> = {
  quoted: "Квота рассчитана",
  pending: "Ожидает оплаты",
  paid: "Оплачена",
  issuing: "Выпускается",
  issued: "Выпущена",
  failed: "Ошибка",
  cancelled: "Отменена",
};

export const rentalStatusLabels: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  grace: "Льготный период",
  expired: "Истекла",
  closed: "Закрыта",
};

export const paymentStatusLabels: Record<string, string> = {
  creating: "Создаётся",
  pending: "Ожидает",
  processing: "В обработке",
  succeeded: "Успешно",
  finalized: "Завершён",
  failed: "Ошибка",
  cancelled: "Отменён",
};

export const refundStatusLabels: Record<string, string> = {
  pending: "Ожидает решения",
  approved: "Одобрен",
  rejected: "Отклонён",
  processing: "В обработке",
  completed: "Завершён",
};

export const reconciliationStatusLabels: Record<string, string> = {
  open: "Открыт",
  resolved: "Решён",
};

export const payoutStatusLabels: Record<string, string> = {
  pending: "Ожидает решения",
  approved: "Одобрена",
  rejected: "Отклонена",
};

export const broadcastStatusLabels: Record<string, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  queued: "В очереди",
  sending: "Отправляется",
  sent: "Отправлена",
  sent_with_errors: "Отправлена с ошибками",
  pending: "Ожидает",
  failed: "Ошибка",
};

export const audienceSegmentLabels: Record<string, string> = {
  all: "Все пользователи",
  active: "Только активные",
  blocked: "Только заблокированные",
};

export const webhookStatusLabels: Record<string, string> = {
  received: "Получен",
  processed: "Обработан",
  finalize_failed: "Ошибка финализации",
  requeued: "В очереди на повтор",
  failed: "Ошибка",
};

export const operationStatusLabels: Record<string, string> = {
  processing: "В обработке",
  completed: "Завершена",
  failed: "Ошибка",
};

export const transactionStatusLabels: Record<string, string> = {
  completed: "Проведена",
  declined: "Отклонена",
  pending: "В обработке",
  reversed: "Отменена",
  refunded: "Возврат",
};

export const severityLabels: Record<string, string> = {
  error: "Ошибка",
  warning: "Предупреждение",
  critical: "Критично",
  info: "Информация",
};

export const feeItemLabels: Record<string, string> = {
  issuance: "Выпуск карты",
  funding: "Пополнение карты",
  unload: "Выгрузка с карты",
  transaction: "Транзакция по карте",
  fx: "Конвертация валюты",
  maintenance: "Обслуживание карты",
  decline: "Отклонённая операция",
  tokenization: "Токенизация карты",
  chargeback: "Чарджбэк",
};

export const feeItemDescriptions: Record<string, string> = {
  issuance: "Разовая комиссия 2328 за выпуск виртуальной карты",
  funding: "Комиссия за зачисление средств на карту",
  unload: "Комиссия за вывод остатка с карты",
  transaction: "Комиссия за каждую покупку по карте",
  fx: "Наценка при конвертации валюты покупки",
  maintenance: "Периодическая плата за обслуживание карты",
  decline: "Плата за отклонённую операцию",
  tokenization: "Плата за привязку карты к платёжному сервису",
  chargeback: "Плата при оспаривании операции клиентом",
};

export const collectionLabels: Record<string, string> = {
  upfront: "Сразу",
  usage: "По факту",
};

export const chargedFromLabels: Record<string, string> = {
  wallet: "С кошелька аккаунта",
  card: "С карты",
};

export const periodLabels: Record<string, string> = {
  none: "Разово",
  monthly: "Ежемесячно",
  daily: "Ежедневно",
  yearly: "Ежегодно",
};

export const featureFlagDescriptions: Record<string, string> = {
  "cards.demo": "Показывать демонстрационные карты и продукты",
  "payments.new-provider": "Включить новый платёжный провайдер в кабинете",
  "issuance.auto": "Автоматический выпуск карты после оплаты",
  "broadcasts.enabled": "Разрешить отправку рассылок из админки",
};

export const settingDescriptions: Record<string, string> = {
  maintenance_mode: "Режим технических работ: клиентские API отвечают 503",
  support_link: "Ссылка на поддержку в Telegram",
  default_currency: "Валюта отображения по умолчанию для новых пользователей",
  demo_ttl_hours: "Срок жизни демо-карты в часах",
};

export function describeFlag(key: string, fallback?: string | null): string {
  return fallback || featureFlagDescriptions[key] || "Пользовательский флаг: уточните назначение у команды";
}

export function describeSetting(key: string, fallback?: string | null): string {
  return fallback || settingDescriptions[key] || "Пользовательская настройка: уточните назначение у команды";
}

export const adminActionLabels: Record<string, string> = {
  "user.block": "Блокировка пользователя",
  "user.unblock": "Разблокировка пользователя",
  "user.delete": "Удаление пользователя",
  "user.restore": "Восстановление пользователя",
  "user.revoke_sessions": "Отзыв сессий",
  "user.note_add": "Заметка о пользователе",
  "user.note_delete": "Удаление заметки",
  "user.tag_assign": "Назначение тега",
  "user.tag_remove": "Снятие тега",
  "user.tag_create": "Создание тега",
  "card.freeze": "Заморозка карты",
  "card.unfreeze": "Разморозка карты",
  "card.close": "Закрытие карты",
  "card.fund": "Пополнение карты",
  "card.unload": "Выгрузка с карты",
  "refund.approve": "Одобрение возврата",
  "refund.reject": "Отклонение возврата",
  "refund.process": "Возврат в обработке",
  "refund.complete": "Завершение возврата",
  "reconciliation.resolve": "Закрытие сверки",
  "payout.approve": "Одобрение выплаты",
  "payout.reject": "Отклонение выплаты",
  "campaign.create": "Создание кампании",
  "campaign.update": "Изменение кампании",
  "promo.create": "Создание промокода",
  "promo.update": "Изменение промокода",
  "webhook.requeue": "Повтор webhook-события",
  "feature_flag.upsert": "Изменение feature flag",
  "system.setting_upsert": "Изменение системной настройки",
  "system.maintenance": "Режим техработ",
  "role.create": "Создание роли",
  "role.update": "Изменение роли",
  "admin.allowlist": "Изменение доступа администратора",
  "admin.allowlist_update": "Изменение доступа администратора",
  "permissions.seed": "Загрузка каталога прав",
  "referral.settings": "Настройки реферальной программы",
};
