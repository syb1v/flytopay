"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  createAdminPrice,
  getAdminFees,
  getAdminPrices,
  getAdminPricingPreview,
  getAdminProducts,
  updateAdminFees,
  updateAdminProduct,
} from "../../../../lib/api";
import type { AdminPrice, AdminPricingPreview, AdminProduct } from "../../../../lib/api";
import { Badge, Button, Empty, Field, Page, Panel, StatGrid, TextInput } from "../../../../components/admin/ui";

export default function AdminProductEditorPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [prices, setPrices] = useState<AdminPrice[]>([]);
  const [preview, setPreview] = useState<AdminPricingPreview | null>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [maxCards, setMaxCards] = useState("");
  const [issueFee, setIssueFee] = useState("0");
  const [fundBps, setFundBps] = useState("0");
  const [unloadBps, setUnloadBps] = useState("0");
  const [markupBps, setMarkupBps] = useState("0");
  const [newPrice, setNewPrice] = useState({ termDays: "30", amount: "1000", fee: "0", currency: "USD" });
  const [quoteAmount, setQuoteAmount] = useState("1000");
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
    getAdminFees(productId)
      .then((policy) => {
        if (!policy) return;
        setIssueFee(String(policy.issueFeeMinor));
        setFundBps(String(policy.fundFeeBps));
        setUnloadBps(String(policy.unloadFeeBps));
        setMarkupBps(String(policy.markupBps));
      })
      .catch(() => undefined);
    getAdminPricingPreview(productId)
      .then(setPreview)
      .catch(() => setPreview(null));
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
        markup_bps: Number(markupBps) || 0,
        currency: product.currency,
        scale: 2,
      });
      setMessage("Комиссии и накрутка сохранены");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить комиссии");
    } finally {
      setBusy(false);
    }
  };
  const addPrice = async () => {
    if (!product) return;
    const termDays = Number(newPrice.termDays);
    const amount = Number(newPrice.amount);
    if (!termDays || Number.isNaN(amount)) {
      setError("Укажите срок и цену");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAdminPrice(product.id, {
        term_days: termDays,
        amount_minor: amount,
        fee_minor: Number(newPrice.fee) || 0,
        currency: newPrice.currency,
        scale: 2,
      });
      setMessage("Новая цена добавлена, предыдущая версия переведена в архив");
      load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить цену");
    } finally {
      setBusy(false);
    }
  };
  const refreshPreview = async () => {
    if (!productId) return;
    setBusy(true);
    try {
      setPreview(await getAdminPricingPreview(productId, Number(quoteAmount) || 1000));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось получить данные провайдера");
    } finally {
      setBusy(false);
    }
  };

  const provider = preview?.provider;

  return (
    <Page
      title={product ? product.name : "Продукт"}
      description={product ? `${product.code} · ${product.scheme.toUpperCase()} · ${product.currency}` : undefined}
      backHref="/admin/catalog"
      backLabel="Все продукты"
      actions={
        product && (
          <>
            <Badge tone={product.enabled ? "success" : "danger"}>{product.enabled ? "Включён" : "Выключен"}</Badge>
            <Badge tone={provider?.configured ? "info" : "neutral"}>
              {provider?.configured ? "Провайдер доступен" : "Провайдер не настроен"}
            </Badge>
          </>
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
          <Panel title="Комиссии и накрутка">
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
              <Field label="Целевая накрутка, bps" hint="Плановый процент маржи над закупкой провайдера">
                <TextInput
                  inputMode="numeric"
                  value={markupBps}
                  onChange={(event) => setMarkupBps(event.target.value)}
                />
              </Field>
            </div>
            <div className="adm-panel-actions" style={{ marginTop: 16 }}>
              <Button variant="primary" busy={busy} onClick={saveFees}>
                Сохранить комиссии
              </Button>
            </div>
          </Panel>
          <Panel
            title="Проверка закупки и маржи"
            actions={
              <div className="adm-page-actions">
                <TextInput
                  inputMode="numeric"
                  value={quoteAmount}
                  onChange={(event) => setQuoteAmount(event.target.value)}
                  placeholder="Сумма, minor"
                />
                <Button variant="secondary" busy={busy} onClick={refreshPreview}>
                  Обновить из 2328
                </Button>
              </div>
            }
          >
            {provider?.pricingError && <p className="adm-modal-error">Тарифы провайдера: {provider.pricingError}</p>}
            {provider?.quoteError && <p className="adm-modal-error">Quote провайдера: {provider.quoteError}</p>}
            {preview && (
              <>
                <StatGrid
                  items={[
                    {
                      label: "Закупка выпуска",
                      value:
                        preview.providerFeeMinor === null
                          ? "—"
                          : `${(preview.providerFeeMinor / 100).toLocaleString("ru-RU")} USD`,
                      hint: `quote на ${(preview.quoteAmountMinor / 100).toLocaleString("ru-RU")} USD`,
                    },
                    {
                      label: "Наша комиссия выпуска",
                      value: `${(preview.feePolicy?.issueFeeMinor ?? 0) / 100} USD`,
                      hint: `накрутка ${((preview.feePolicy?.markupBps ?? 0) / 100).toFixed(1)}%`,
                    },
                    {
                      label: "Комиссия пополнения",
                      value: `${((preview.feePolicy?.fundFeeBps ?? 0) / 100).toFixed(2)}%`,
                    },
                    {
                      label: "Комиссия выгрузки",
                      value: `${((preview.feePolicy?.unloadFeeBps ?? 0) / 100).toFixed(2)}%`,
                    },
                  ]}
                />
                <div className="adm-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Срок</th>
                        <th>Цена для пользователя</th>
                        <th>Комиссия сроков</th>
                        <th>Маржа к закупке</th>
                        <th>Маржа, bps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.prices.map((price) => (
                        <tr key={price.id}>
                          <td>{price.termDays} дней</td>
                          <td>
                            {(price.amountMinor / 100).toLocaleString("ru-RU")} {price.currency}
                          </td>
                          <td>
                            {(price.feeMinor / 100).toLocaleString("ru-RU")} {price.currency}
                          </td>
                          <td>
                            {price.marginMinor === null
                              ? "—"
                              : `${(price.marginMinor / 100).toLocaleString("ru-RU")} USD`}
                          </td>
                          <td>{price.marginBps === null ? "—" : `${(price.marginBps / 100).toFixed(2)}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.prices.length === 0 && <Empty>Активных цен нет — добавьте цену ниже.</Empty>}
                </div>
              </>
            )}
            {!preview && <Empty>Провайдер не отвечает или ключ не настроен.</Empty>}
          </Panel>
          <Panel title="Добавить цену" actions={<Badge tone="warning">Старая версия уйдёт в архив</Badge>}>
            <div className="adm-form-grid">
              <Field label="Срок, дней">
                <TextInput
                  inputMode="numeric"
                  value={newPrice.termDays}
                  onChange={(event) => setNewPrice({ ...newPrice, termDays: event.target.value })}
                />
              </Field>
              <Field label="Цена, minor units">
                <TextInput
                  inputMode="numeric"
                  value={newPrice.amount}
                  onChange={(event) => setNewPrice({ ...newPrice, amount: event.target.value })}
                />
              </Field>
              <Field label="Комиссия, minor units">
                <TextInput
                  inputMode="numeric"
                  value={newPrice.fee}
                  onChange={(event) => setNewPrice({ ...newPrice, fee: event.target.value })}
                />
              </Field>
              <Field label="Валюта">
                <TextInput
                  value={newPrice.currency}
                  onChange={(event) => setNewPrice({ ...newPrice, currency: event.target.value.toUpperCase() })}
                />
              </Field>
            </div>
            <div className="adm-panel-actions" style={{ marginTop: 16 }}>
              <Button variant="primary" busy={busy} onClick={addPrice}>
                Добавить цену
              </Button>
            </div>
            <div className="adm-table" style={{ marginTop: 16 }}>
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
            </div>
          </Panel>
        </>
      )}
    </Page>
  );
}
