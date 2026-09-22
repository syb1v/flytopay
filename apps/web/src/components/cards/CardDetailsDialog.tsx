"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LockKeyhole, MapPin, X } from "lucide-react";
import { CardVisual } from "./CardVisual";
import type { Card } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";

export function CardDetailsDialog({ card, open, onClose }: { card: Card | null; open: boolean; onClose: () => void }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="details-overlay" />
        <Dialog.Content className="details-dialog">
          <header className="card-dialog-header">
            <Dialog.Title>{ru ? "Реквизиты карты" : "Card details"}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={ru ? "Закрыть окно" : "Close dialog"}>
              <X size={18} />
            </Dialog.Close>
          </header>
          <Dialog.Description className="settings-muted">
            {ru ? "Данные карты и платёжный адрес" : "Card information and billing address"}
          </Dialog.Description>
          {card && (
            <>
              <CardVisual
                maskedPan={card.masked_pan ?? (card.last_four ? `•••• •••• •••• ${card.last_four}` : null)}
                status={card.status}
                variant={card.product_code ?? "default"}
                balance={card.balance_minor == null ? undefined : `${card.balance_minor / 100} ${card.currency}`}
              />
              <dl className="details-section">
                <div className="detail-row">
                  <dt>{ru ? "Номер карты" : "Card number"}</dt>
                  <dd>{card.masked_pan ?? "•••• •••• •••• ••••"}</dd>
                </div>
                <div className="details-split">
                  <div className="detail-row">
                    <dt>{ru ? "Срок действия" : "Expiry"}</dt>
                    <dd>—</dd>
                  </div>
                  <div className="detail-row">
                    <dt>CVV</dt>
                    <dd>•••</dd>
                  </div>
                </div>
                <div className="detail-row">
                  <dt>{ru ? "Держатель" : "Cardholder"}</dt>
                  <dd>—</dd>
                </div>
              </dl>
              <p className="unavailable-note">
                <MapPin size={18} aria-hidden="true" />
                {ru ? "Платёжный адрес пока недоступен" : "Billing address is unavailable"}
              </p>
              <p className="secure-note">
                <LockKeyhole size={18} aria-hidden="true" />
                {ru ? "Защищённый показ реквизитов ещё не подключён." : "Secure card details are not connected yet."}
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
