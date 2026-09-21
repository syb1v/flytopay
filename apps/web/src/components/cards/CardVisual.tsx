import { CreditCard } from "lucide-react";
import { usePreferences } from "../providers/PreferencesProvider";

export function CardVisual({ maskedPan, status, balance, scheme }: { maskedPan?: string | null; status?: string; balance?: string; scheme?: string }) {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  return <article className={`card-visual card-visual-${status === "frozen" ? "frozen" : "active"}`}>
    <div className="card-visual-top"><strong><img src="/favicon.svg" width="32" height="32" alt="" /> Flytopay</strong><CreditCard size={22} strokeWidth={1.7} aria-hidden="true" /></div>
    <div className="card-visual-chip"><span /></div>
    <div className="card-visual-number">{maskedPan ?? "••••  ••••  ••••  ••••"}</div>
    <div className="card-visual-bottom"><span><small>{ru ? "Баланс" : "Balance"}</small>{balance ?? "—"}</span><span><small>{ru ? "Статус" : "Status"}</small>{status ?? "—"}</span>{scheme && <b>{scheme}</b>}</div>
  </article>;
}
