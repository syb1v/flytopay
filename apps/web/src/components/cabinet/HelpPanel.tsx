"use client";

import { ArrowLeft, ArrowUpRight, CircleHelp, CreditCard, MessageCircle, ShieldCheck, Wallet } from "lucide-react";

const copy = {
  ru: {
    back: "Назад",
    intro: "Ответы на важные вопросы — и поддержка, если нужна помощь лично.",
    contact: "Нужна помощь?",
    contactText: "Напишите нам в Telegram. Поможем разобраться с картой, балансом или платежом.",
    action: "Написать в поддержку",
    faq: "Частые вопросы",
    items: [
      {
        title: "Как выпустить карту?",
        text: "На главной странице нажмите «Выпустить карту», выберите доступный продукт и укажите данные держателя. После расчёта стоимости подтвердите оплату с баланса Flytopay. Статус выпуска появится на главной.",
      },
      {
        title: "Как пополнить баланс?",
        text: "Нажмите «Пополнить» в блоке баланса на главной. Выберите доступный способ оплаты и следуйте инструкциям. Баланс обновится после подтверждения платежа.",
      },
      {
        title: "Почему выпуск или перевод в обработке?",
        text: "Операции с картами обрабатываются провайдером асинхронно. Проверяйте статус карты на главной и операции в истории. Если статус долго не меняется, напишите в поддержку.",
      },
      {
        title: "Почему выбранная карта недоступна?",
        text: "Выпуск доступен только для продуктов, которые настроены у провайдера и для которых получена цена. Если нужный продукт недоступен, попробуйте позже или обратитесь в поддержку.",
      },
      {
        title: "Как воспользоваться сервисами?",
        text: "Откройте раздел «Сервисы». Доступные предложения можно открыть из карточки сервиса. Для ещё не подключённых способов оплаты указан статус «Скоро».",
      },
    ],
  },
  en: {
    back: "Back",
    intro: "Quick answers to common questions, with personal support when you need it.",
    contact: "Need a hand?",
    contactText: "Message us on Telegram. We'll help with your card, balance or payment.",
    action: "Contact support",
    faq: "Frequently asked questions",
    items: [
      {
        title: "How do I issue a card?",
        text: "On the home screen, select “Issue a card”, choose an available product and enter cardholder details. Review the quote and confirm payment from your Flytopay wallet. You'll see the issuance status on the home screen.",
      },
      {
        title: "How do I top up my balance?",
        text: "Tap “Top up” on the home screen, choose an available payment method and follow the instructions. Your balance updates when payment is confirmed.",
      },
      {
        title: "Why is my card operation still processing?",
        text: "Card operations are processed asynchronously by the provider. Check the card status on the home screen and your transaction history. If the status doesn't change for a while, contact support.",
      },
      {
        title: "Why is a card unavailable?",
        text: "Only products configured by the provider with a current price can be issued. If your preferred product isn't available, try later or contact support.",
      },
      {
        title: "How do I use services?",
        text: "Open the Services tab. Available offers can be opened from their cards. Payment options that aren't connected yet are marked “Coming soon”.",
      },
    ],
  },
} as const;

const icons = [CreditCard, Wallet, ShieldCheck, CreditCard, CircleHelp] as const;

export function HelpPanel({ language, onBack }: { language: "ru" | "en"; onBack: () => void }) {
  const t = copy[language];
  return (
    <section className="help-page">
      <button className="help-back" onClick={onBack}>
        <ArrowLeft size={16} /> {t.back}
      </button>
      <div className="help-hero">
        <div>
          <span className="account-kicker">FLYTOPAY / HELP CENTER</span>
          <h2>{t.contact}</h2>
          <p>{t.intro}</p>
        </div>
        <MessageCircle className="help-hero-mark" size={108} strokeWidth={1} aria-hidden="true" />
      </div>
      <div className="account-group-label">{t.faq}</div>
      <div className="help-faq">
        {t.items.map((item, index) => {
          const Icon = icons[index];
          return (
            <details key={item.title} className="help-question">
              <summary>
                <span className="help-question-icon">
                  <Icon size={19} />
                </span>
                <strong>{item.title}</strong>
                <span className="help-question-toggle" aria-hidden="true">
                  ＋
                </span>
              </summary>
              <p>{item.text}</p>
            </details>
          );
        })}
      </div>
      <div className="help-contact">
        <span className="help-contact-icon">
          <MessageCircle size={23} />
        </span>
        <div>
          <strong>{t.contact}</strong>
          <p>{t.contactText}</p>
        </div>
        <a href="https://t.me/flytopay_support_bot" target="_blank" rel="noopener noreferrer">
          {t.action} <ArrowUpRight size={17} />
        </a>
      </div>
    </section>
  );
}
