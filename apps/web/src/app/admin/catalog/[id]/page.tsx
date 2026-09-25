"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAdminPrices, getAdminProducts, updateAdminFees, updateAdminProduct } from "../../../../lib/api";
import type { AdminPrice, AdminProduct } from "../../../../lib/api";
import { Badge, Button, Empty, Field, Page, Panel, TextInput } from "../../../../components/admin/ui";

export default function AdminProductEditorPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [prices, setPrices] = useState<AdminPrice[]>([]);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [maxCards, setMaxCards] = useState("");
  const [issueFee, setIssueFee] = useState("0");
  const [fundBps, setFundBps] = useState("0");
  const [unloadBps, setUnloadBps] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!productId) return;
    getAdminProducts()
      .then((products) => {
        const found = products.find((item) => item.id === productId) ?? null;
        setProduct(found);
        if (found) {
          setName(found.name);
          setEnabled(found.enabled);
          setMaxCards(found.maxCardsPerCardholder === null ? "" : String(found.maxCardsPerCardholder));
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить продукт"));
    getAdminPrices(productId)
      .then(setPrices)
      .catch(() => setPrices([]));
  }, [productId]);
  useEffect(() => load(), [load]);

  const saveProduct = async () => {
    if (!product || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminProduct(product.id, {
        name: name.trim(),
        enabled,
        max_cards_per_cardholder: maxCards ? Number(maxCards) : null,
      });
      setMessage("Продукт сохранён");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить продукт");
    } finally {
      setBusy(false);
    }
  };
  const saveFees = async () => {
    if (!product) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminFees(product.id, {
        issue_fee_minor: Number(issueFee) || 0,
        fund_fee_bps: Number(fundBps) || 0,
        unload_fee_bps: Number(unloadBps) || 0,
        currency: product.currency,
        scale: 2,
      });
      setMessage("Комиссии сохранены");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить комиссии");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={product ? product.name : "Продукт"}
      description={product ? `${product.code} · ${product.scheme.toUpperCase()} · ${product.currency}` : undefined}
      backHref="/admin/catalog"
      backLabel="Все продукты"
      actions={
        product && (
          <Badge tone={product.enabled ? "success" : "danger"}>{product.enabled ? "Включён" : "Выключен"}</Badge>
        )
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {message && <p className="adm-page-sub">{message}</p>}
      {!product && !error && <Empty>Загрузка…</Empty>}
      {product && (
        <>
          <Panel title="Основные настройки">
            <div className="adm-form-grid">
              <Field label="Название">
                <TextInput value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Максимум карт на пользователя">
                <TextInput
                  inputMode="numeric"
                  value={maxCards}
                  onChange={(event) => setMaxCards(event.target.value)}
                  placeholder="Без ограничения"
                />
              </Field>
              <Field label="Доступность">
                <label className="adm-toggle">
                  <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                  Продукт доступен пользователям
                </label>
              </Field>
            </div>
            <div className="adm-panel-actions" style={{ marginTop: 16 }}>
              <Button variant="primary" busy={busy} onClick={saveProduct}>
                Сохранить продукт
              </Button>
            </div>
          </Panel>
          <Panel title="Комиссии">
            <div className="adm-form-grid">
              <Field label="Комиссия выпуска, minor units" hint="Например, 500 = 5.00 USD">
                <TextInput inputMode="numeric" value={issueFee} onChange={(event) => setIssueFee(event.target.value)} />
              </Field>
              <Field label="Комиссия пополнения, bps">
                <TextInput inputMode="numeric" value={fundBps} onChange={(event) => setFundBps(event.target.value)} />
              </Field>
              <Field label="Комиссия выгрузки, bps">
                <TextInput
                  inputMode="numeric"
                  value={unloadBps}
                  onChange={(event) => setUnloadBps(event.target.value)}
                />
              </Field>
            </div>
            <div className="adm-panel-actions" style={{ marginTop: 16 }}>
              <Button variant="primary" busy={busy} onClick={saveFees}>
                Сохранить комиссии
              </Button>
            </div>
          </Panel>
          <Panel title="История цен" actions={<Badge tone="info">Версии сохраняются</Badge>}>
            <div className="adm-table">
              <table>
                <thead>
                  <tr>
                    <th>Срок</th>
                    <th>Цена</th>
                    <th>Комиссия</th>
                    <th>Действует с</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((price) => (
                    <tr key={price.id}>
                      <td>{price.termDays} дней</td>
                      <td>
                        {(price.amountMinor / 100).toLocaleString("ru-RU")} {price.currency}
                      </td>
                      <td>
                        {(price.feeMinor / 100).toLocaleString("ru-RU")} {price.currency}
                      </td>
                      <td>{new Date(price.effectiveFrom).toLocaleDateString("ru-RU")}</td>
                      <td>
                        <Badge tone={price.isActive ? "success" : "neutral"}>
                          {price.isActive ? "Активна" : "Архив"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prices.length === 0 && <Empty>Цены ещё не заданы.</Empty>}
            </div>
          </Panel>
        </>
      )}
    </Page>
  );
}
