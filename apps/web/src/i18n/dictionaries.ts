export type Language = "ru" | "en";

export const dictionaries = {
  ru: {
    cabinet: "Личный кабинет",
    lead: "Управляйте картами и настройками в одном месте.",
    settings: "Настройки",
    saving: "Сохраняем…",
    loading: "Загрузка настроек…",
    interfaceLanguage: "Язык интерфейса",
    languageHint: "Язык кабинета и уведомлений",
    displayCurrency: "Валюта отображения",
    currencyHint: "Не меняет фактическую валюту операции",
    topUp: "Пополнить баланс",
    amount: "Сумма",
    demoAmount: "10.00 USD · тестовый размер заказа",
    continue: "Продолжить",
    creating: "Создаём…",
    paymentCreated: "Платёж создан. Открываем страницу оплаты…",
    paymentUnavailable: "Платёж недоступен",
  },
  en: {
    cabinet: "Personal cabinet",
    lead: "Manage cards and settings in one place.",
    settings: "Settings",
    saving: "Saving…",
    loading: "Loading settings…",
    interfaceLanguage: "Interface language",
    languageHint: "Cabinet and notification language",
    displayCurrency: "Display currency",
    currencyHint: "Does not change the operation currency",
    topUp: "Top up balance",
    amount: "Amount",
    demoAmount: "10.00 USD · demo order amount",
    continue: "Continue",
    creating: "Creating…",
    paymentCreated: "Payment created. Opening checkout…",
    paymentUnavailable: "Payment unavailable",
  },
} satisfies Record<Language, Record<string, string>>;

export function getDictionary(language: Language) {
  return dictionaries[language];
}
