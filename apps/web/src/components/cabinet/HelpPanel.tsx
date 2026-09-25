"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleHelp,
  CreditCard,
  FileText,
  MessageCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { getPublicFaq, getPublicLegal, getPublicLegalDocument } from "../../lib/api";
import type { PublicFaqItem, PublicLegalItem } from "../../lib/api";

const copy = {
  ru: {
    back: "Назад",
    intro: "Ответы на важные вопросы — и поддержка, если нужна помощь лично.",
    contact: "Нужна помощь?",
    contactText: "Напишите нам в Telegram. Поможем разобраться с картой, балансом или платежом.",
    action: "Написать в поддержку",
    faq: "Частые вопросы",
    documents: "Документы",
    documentsHint: "Тексты документов настраиваются в админке.",
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
    documents: "Documents",
    documentsHint: "Document texts are managed in the admin panel.",
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
  const [faq, setFaq] = useState<PublicFaqItem[] | null>(null);
  const [legal, setLegal] = useState<PublicLegalItem[]>([]);
  const [document, setDocument] = useState<{ title: string; body: string } | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    getPublicFaq(language)
      .then((items) => setFaq(items))
      .catch(() => setFaq(null));
    getPublicLegal(language)
      .then(setLegal)
      .catch(() => setLegal([]));
  }, [language]);

  const openDocument = async (item: PublicLegalItem) => {
    setDocumentError(null);
    try {
      const full = await getPublicLegalDocument(item.slug);
      setDocument({ title: full.title, body: full.body });
    } catch {
      setDocumentError("Документ временно недоступен.");
    }
  };

  const questions =
    faq && faq.length > 0
      ? faq.slice(0, 8)
      : t.items.map((item) => ({ id: item.title, title: item.title, body: item.text }));

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
        {questions.map((item, index) => {
          const Icon = icons[index % icons.length];
          return (
            <details key={item.id} className="help-question">
              <summary>
                <span className="help-question-icon">
                  <Icon size={19} />
                </span>
                <strong>{item.title}</strong>
                <span className="help-question-toggle" aria-hidden="true">
                  ＋
                </span>
              </summary>
              <p>{item.body}</p>
            </details>
          );
        })}
      </div>
      {legal.length > 0 && (
        <>
          <div className="account-group-label">{t.documents}</div>
          <div className="help-documents">
            {legal.map((item) => (
              <button key={item.slug} className="help-document-button" onClick={() => openDocument(item)}>
                <FileText size={18} />
                <span>{item.title}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </>
      )}
      {documentError && <p className="settings-muted">{documentError}</p>}
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
      {document && (
        <div className="details-overlay" onClick={() => setDocument(null)} role="presentation">
          <section
            className="details-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="admin-dialog-close" onClick={() => setDocument(null)} aria-label="Закрыть">
              ×
            </button>
            <h2>{document.title}</h2>
            <p className="help-document-body">{document.body}</p>
            <button className="ui-button ui-button-secondary" onClick={() => setDocument(null)}>
              Закрыть
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
