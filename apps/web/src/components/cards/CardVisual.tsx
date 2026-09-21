import { Radio, CreditCard } from "lucide-react";

export function CardVisual({ maskedPan, status, balance, scheme = "VISA" }: { maskedPan?: string | null; status?: string; balance?: string; scheme?: string }) {
  return <article className={`card-visual card-visual-${status === "frozen" ? "frozen" : "active"}`}>
    <div className="card-visual-top"><strong>Flytopay</strong><Radio size={22} strokeWidth={1.7} /></div>
    <div className="card-visual-chip"><span /></div>
    <div className="card-visual-number">{maskedPan ?? "••••  ••••  ••••  ••••"}</div>
    <div className="card-visual-bottom"><span><small>Баланс</small>{balance ?? "—"}</span><span><small>Статус</small>{status ?? "—"}</span><b>{scheme}</b></div>
  </article>;
}
