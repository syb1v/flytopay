"use client";

import { useEffect, useState } from "react";
import { Apple, Check, CreditCard, Globe2, LockKeyhole, Smartphone } from "lucide-react";
import { getCardProducts, type CardProduct } from "../../lib/api";
import { usePreferences } from "../providers/PreferencesProvider";

const terms = [30, 90, 180, 365] as const;

export function IssueCardPanel() {
  const { preferences } = usePreferences();
  const ru = preferences.language === "ru";
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [selected, setSelected] = useState<CardProduct | null>(null);
  const [term, setTerm] = useState<number>(30);
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getCardProducts().then((items) => { setProducts(items); setSelected(items[0] ?? null); }).catch(() => setProducts([])).finally(() => setLoading(false)); }, []);
  const setting = (key: string) => selected?.provider_settings?.find((item) => item.key === key)?.value;
  if (loading) return <section className="page-panel"><div className="panel-icon"><CreditCard size={38} /></div><h2>{ru ? "Загружаем продукты" : "Loading products"}</h2></section>;
  return <section className="issue-layout"><div className="issue-main"><div className="panel-icon"><CreditCard size={38} /></div><h2>{ru ? "Выпуск карты" : "Issue a card"}</h2><p>{ru ? "Выберите реальный продукт из каталога 2328. Доступность функций приходит от провайдера." : "Choose a real product from the 2328 catalog. Features come from the provider."}</p><div className="product-grid">{products.map((product) => <button className={`product-option ${selected?.code === product.code ? "selected" : ""}`} key={product.code} onClick={() => setSelected(product)}><span className="product-option-icon"><CreditCard size={19} /></span><span><strong>{product.name}</strong><small>{product.scheme.toUpperCase()} · {product.currency}</small></span>{selected?.code === product.code && <Check size={18} />}</button>)}</div>{!products.length && <div className="unavailable-note"><LockKeyhole size={18} />{ru ? "Каталог 2328 пока недоступен. Проверьте CAAS_API_KEY." : "2328 catalog is unavailable. Check CAAS_API_KEY."}</div>}<label className="field-label">{ru ? "Страна держателя" : "Cardholder country"}<select value={country} onChange={(event) => setCountry(event.target.value)}><option value="US">United States</option><option value="GB">United Kingdom</option><option value="DE">Germany</option><option value="AE">United Arab Emirates</option><option value="TR">Türkiye</option></select></label><div className="term-picker"><span>{ru ? "Срок выпуска" : "Issue term"}</span><div>{terms.map((value) => <button className={term === value ? "selected" : ""} key={value} onClick={() => setTerm(value)}>{value} <small>{ru ? "дн." : "days"}</small></button>)}</div></div></div><aside className="issue-summary"><div className="summary-heading"><Globe2 size={18} />{ru ? "Возможности продукта" : "Product capabilities"}</div><div className="capability-list"><Capability label="3DS" value={setting("three_ds")} /><Capability label="Apple Pay" icon={<Apple size={15} />} value={setting("apple_pay")} /><Capability label="Google Pay" icon={<Smartphone size={15} />} value={setting("google_pay")} /><Capability label={ru ? "Лимит карт на держателя" : "Cards per cardholder"} value={selected?.max_cards_per_cardholder} /></div><div className="summary-divider" /><p className="settings-muted">{ru ? "После выбора продукта покажем quote, комиссию и итоговую сумму до оплаты." : "We show the quote, fee and final total before payment."}</p><button className="lime-action" disabled={!selected}>{ru ? "Рассчитать стоимость" : "Calculate price"}</button></aside></section>;
}

function Capability({ label, value, icon }: { label: string; value: boolean | number | string | null | undefined; icon?: React.ReactNode }) { const available = value === true || (typeof value === "number" && value > 0) || (typeof value === "string" && value.length > 0); return <div className="capability-row"><span>{icon}{label}</span><b className={available ? "available" : "muted-capability"}>{typeof value === "boolean" ? (value ? "✓" : "—") : value ?? "—"}</b></div>; }
