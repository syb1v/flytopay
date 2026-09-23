"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, Gamepad2, QrCode, Smartphone, TrafficCone } from "lucide-react";
import { Modal } from "../ui/modal";

type ServiceId = "vpn" | "qr" | "utilities" | "fines" | "steam" | "mobile";
type Language = "ru" | "en";

const services = [
  { id: "qr", icon: QrCode, number: "01" },
  { id: "utilities", icon: Building2, number: "02" },
  { id: "fines", icon: TrafficCone, number: "03" },
  { id: "steam", icon: Gamepad2, number: "04" },
  { id: "mobile", icon: Smartphone, number: "05" },
  { id: "vpn", icon: null, number: "06" },
] as const;

const content = {
  ru: {
    lead: "Повседневные задачи — в одном месте.",
    intro: "Оплачивайте нужное и находите больше возможностей с Flytopay.",
    section: "Каталог сервисов",
    count: "06 направлений",
    available: "ДОСТУПНО СЕЙЧАС",
    soon: "СКОРО",
    details: "Подробнее",
    close: "Закрыть",
    waiting: "Подключаем сервис",
    waitingText:
      "Пока этот способ оплаты недоступен в Flytopay. Мы работаем над подключением — здесь появится возможность воспользоваться сервисом, когда он будет готов.",
    vpnOffer: "3 дня + 50 ₽ в подарок",
    vpnAction: "Открыть RageNet в Telegram",
    vpnNote: "Предложение для клиентов Flytopay. Подключение и условия — в боте RageNet.",
    services: {
      vpn: {
        title: "VPN без границ",
        subtitle: "Свой сервис для свободного доступа",
        description:
          "У нас есть собственный VPN-сервис с обходом белых списков и ограничений. Специально для наших клиентов дарим 3 дня пробного периода и 50 ₽ на баланс.",
      },
      qr: {
        title: "Оплата по QR",
        subtitle: "Наведите камеру и оплатите",
        description:
          "Оплата покупок и счетов по QR-коду прямо из Flytopay. Когда сервис будет подключён, здесь появится сканирование и подтверждение платежа.",
      },
      utilities: {
        title: "ЖКХ",
        subtitle: "Домашние счета без хлопот",
        description:
          "Оплачивайте коммунальные услуги в одном месте. После подключения сервиса здесь можно будет найти начисления и проверить детали перед оплатой.",
      },
      fines: {
        title: "Штрафы ГИБДД",
        subtitle: "Проверка и оплата штрафов",
        description:
          "Проверяйте начисления и оплачивайте штрафы ГИБДД. Функция появится после подключения поставщика данных и платежей.",
      },
      steam: {
        title: "Steam",
        subtitle: "Пополнение игрового кошелька",
        description:
          "Пополняйте кошелёк Steam для игр и покупок. Мы добавим ввод логина и подтверждение суммы, когда сервис станет доступен.",
      },
      mobile: {
        title: "Мобильная связь",
        subtitle: "Оставайтесь на связи",
        description:
          "Пополняйте баланс мобильного телефона. После подключения сервиса здесь появится ввод номера и выбор суммы пополнения.",
      },
    },
  },
  en: {
    lead: "Everyday essentials, all in one place.",
    intro: "Pay for what matters and discover more with Flytopay.",
    section: "Explore services",
    count: "06 services",
    available: "AVAILABLE NOW",
    soon: "COMING SOON",
    details: "Learn more",
    close: "Close",
    waiting: "We're connecting this service",
    waitingText:
      "This payment option isn't available in Flytopay yet. We're working on it — you'll be able to use it here once it's ready.",
    vpnOffer: "3 days + 50 ₽ on us",
    vpnAction: "Open RageNet in Telegram",
    vpnNote: "An offer for Flytopay customers. Activation and terms are available in the RageNet bot.",
    services: {
      vpn: {
        title: "VPN without borders",
        subtitle: "Our own service for open access",
        description:
          "We have our own VPN service that works around allowlists and restrictions. Flytopay customers get a 3-day trial and 50 ₽ added to their balance.",
      },
      qr: {
        title: "Pay by QR",
        subtitle: "Scan and pay in moments",
        description:
          "Pay for purchases and bills using a QR code in Flytopay. Scanning and payment confirmation will be available once the service is connected.",
      },
      utilities: {
        title: "Utilities",
        subtitle: "Take care of household bills",
        description:
          "Pay your utility bills in one place. Once connected, you'll be able to look up charges and review details before paying.",
      },
      fines: {
        title: "Traffic fines",
        subtitle: "Check and pay fines",
        description:
          "Check and pay traffic fines. This feature will be available once the data and payment provider is connected.",
      },
      steam: {
        title: "Steam",
        subtitle: "Top up your gaming wallet",
        description:
          "Top up your Steam wallet for games and purchases. Account entry and amount confirmation will be added when the service becomes available.",
      },
      mobile: {
        title: "Mobile top-up",
        subtitle: "Stay connected",
        description:
          "Add credit to your mobile phone. You'll be able to enter a number and choose an amount once the service is connected.",
      },
    },
  },
} as const;

export function ServicesPanel({ language }: { language: Language }) {
  const [selected, setSelected] = useState<ServiceId | null>(null);
  const t = content[language];
  const selectedService = selected ? t.services[selected] : null;

  return (
    <section className="services-page">
      <div className="services-hero">
        <div className="services-hero-copy">
          <span className="services-kicker">
            <span /> FLYTOPAY / SERVICES
          </span>
          <h2>{t.lead}</h2>
          <p>{t.intro}</p>
        </div>
        <div className="services-hero-art" aria-hidden="true">
          <span className="services-orbit services-orbit-one" />
          <span className="services-orbit services-orbit-two" />
          <span className="services-hero-glyph">✳</span>
        </div>
        <span className="services-hero-index">01 — 06 / FLYTOPAY</span>
      </div>

      <div className="services-section-heading">
        <h3>{t.section}</h3>
        <span>{t.count}</span>
      </div>

      <div className="services-mosaic">
        {services.map(({ id, icon: Icon, number }) => {
          const item = t.services[id];
          return (
            <button
              type="button"
              key={id}
              className={`services-card services-card-${id}`}
              onClick={() => setSelected(id)}
              aria-label={`${item.title} — ${t.details}`}
            >
              <span className="services-card-top">
                {Icon ? (
                  <span className="services-card-icon">
                    <Icon size={24} strokeWidth={1.7} />
                  </span>
                ) : (
                  <span className="services-card-live">
                    <span className="services-live-dot" aria-hidden="true" /> {t.available}
                  </span>
                )}
                <span className="services-card-number">{number} / 06</span>
              </span>
              <span className="services-card-bottom">
                {id !== "vpn" && <span className="services-card-status">{t.soon}</span>}
                <strong>{item.title}</strong>
                <span className="services-card-subtitle">{item.subtitle}</span>
              </span>
              <ArrowUpRight className="services-card-arrow" size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        eyebrow={selected === "vpn" ? t.available : t.soon}
        title={selectedService?.title ?? ""}
        closeLabel={t.close}
      >
        {selectedService && (
          <div className="services-dialog">
            <p>{selectedService.description}</p>
            {selected === "vpn" ? (
              <>
                <div className="services-dialog-offer">
                  <span>✳</span>
                  <strong>{t.vpnOffer}</strong>
                </div>
                <a
                  className="services-dialog-action"
                  href="https://t.me/RageNet_bot?start=flytopay"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.vpnAction} <ArrowUpRight size={19} />
                </a>
                <small>{t.vpnNote}</small>
              </>
            ) : (
              <div className="services-dialog-pending">
                <span className="services-pending-dot" />
                <div>
                  <strong>{t.waiting}</strong>
                  <span>{t.waitingText}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
