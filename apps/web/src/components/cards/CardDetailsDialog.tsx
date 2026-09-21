"use client";

import { useEffect, useState } from "react";
import { Check, Clipboard, CreditCard, Eye, EyeOff, LockKeyhole, MapPin, ShieldCheck, Snowflake, Unlock } from "lucide-react";
import { CardVisual } from "./CardVisual";
import type { Card } from "../../lib/api";

export function CardDetailsDialog({ card, open, onClose, onToggleFreeze }: { card: Card | null; open: boolean; onClose: () => void; onToggleFreeze?: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { setRevealed(false); }, [card?.id, open]);
  useEffect(() => { if (!revealed) return; const timer = window.setTimeout(() => setRevealed(false), 25000); const hide = () => document.hidden && setRevealed(false); document.addEventListener("visibilitychange", hide); return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", hide); }; }, [revealed]);
  if (!open || !card) return null;
  const copy = async (key: string, value: string) => { await navigator.clipboard.writeText(value.replace(/\s/g, "")); setCopied(key); window.setTimeout(() => setCopied(null), 1500); };
  const secureAvailable = false;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="card-dialog" role="dialog" aria-modal="true" aria-labelledby="card-dialog-title"><header className="card-dialog-header"><div><span className="dashboard-eyebrow">Flytopay</span><h2 id="card-dialog-title">Детали карты</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть">×</button></header><CardVisual maskedPan={revealed ? "4242 4242 4242 4242" : card.masked_pan} status={card.status} balance={card.balance_minor == null ? undefined : `${(card.balance_minor / 100).toFixed(2)} ${card.currency}`} /><div className="secure-note"><ShieldCheck size={18} /><span>{revealed ? "Реквизиты автоматически скроются через 25 секунд" : "Реквизиты доступны только через защищённый канал"}</span></div><section className="details-section"><div className="details-section-title"><span>Платёжные реквизиты</span>{secureAvailable && <button onClick={() => setRevealed((value) => !value)}>{revealed ? <EyeOff size={16} /> : <Eye size={16} />}{revealed ? "Скрыть" : "Показать"}</button>}</div><DetailRow label="Номер карты" value={revealed ? "4242 4242 4242 4242" : (card.masked_pan ?? "•••• •••• •••• ••••")} copyable={revealed} copied={copied === "pan"} onCopy={() => copy("pan", "4242424242424242")} /><div className="details-split"><DetailRow label="Срок действия" value="—" /><DetailRow label="CVV" value={revealed ? "•••" : "•••"} /></div><DetailRow label="Держатель" value="Flytopay user" /></section><section className="details-section"><div className="details-section-title"><span>Billing address</span><MapPin size={16} /></div><div className="unavailable-note"><LockKeyhole size={17} /> Адрес появится после завершения выпуска карты</div></section><div className="dialog-actions"><button className="secondary-action" onClick={onToggleFreeze}>{card.status === "frozen" ? <Unlock size={17} /> : <Snowflake size={17} />}{card.status === "frozen" ? "Разморозить" : "Заморозить"}</button><button className="secondary-action" onClick={onClose}><CreditCard size={17} /> Закрыть</button></div></section></div>;
}

function DetailRow({ label, value, copyable, copied, onCopy }: { label: string; value: string; copyable?: boolean; copied?: boolean; onCopy?: () => void }) {
  return <div className="detail-row"><div><small>{label}</small><strong>{value}</strong></div>{copyable && <button onClick={onCopy} aria-label={`Копировать ${label}`}>{copied ? <Check size={17} /> : <Clipboard size={17} />}</button>}</div>;
}
