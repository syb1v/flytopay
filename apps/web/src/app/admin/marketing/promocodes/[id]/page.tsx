"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { archiveAdminPromo, createAdminPromo, getAdminPromoCode, updateAdminPromo } from "../../../../../lib/api";
import { ActionDialog, Button, Field, Page, Panel, TextInput } from "../../../../../components/admin/ui";

export default function AdminPromoEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const promoId = params.id;
  const isNew = promoId === "new";
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("1000");
  const [bonus, setBonus] = useState("0");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(() => {
    if (isNew || !promoId) return;
    getAdminPromoCode(promoId)
      .then((promo) => {
        setCode(promo.code);
        setDiscount(String(promo.discountBps));
        setBonus(String(promo.bonusMinor));
        setMaxRedemptions(promo.maxRedemptions === null ? "" : String(promo.maxRedemptions));
        setIsActive(promo.isActive);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить промокод"));
  }, [isNew, promoId]);
  useEffect(() => load(), [load]);

  const save = async () => {
    if (!code.trim()) {
      setError("Укажите код промокода");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await createAdminPromo({
          code: code.trim().toUpperCase(),
          discount_bps: Number(discount) || 0,
          bonus_minor: Number(bonus) || 0,
          currency: "USD",
          max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        });
        router.push("/admin/marketing");
        return;
      }
      await updateAdminPromo(promoId, {
        discount_bps: Number(discount) || 0,
        bonus_minor: Number(bonus) || 0,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        is_active: isActive,
      });
      setMessage("Промокод сохранён");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить промокод");
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    setBusy(true);
    try {
      await archiveAdminPromo(promoId);
      router.push("/admin/marketing");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось архивировать промокод");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={isNew ? "Новый промокод" : code || "Промокод"}
      description={isNew ? "Скидка в basis points: 1000 = 10%" : `ID ${promoId}`}
      backHref="/admin/marketing"
      backLabel="Маркетинг"
      actions={
        !isNew && (
          <Button variant="danger" onClick={() => setConfirmArchive(true)}>
            Архивировать
          </Button>
        )
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {message && <p className="adm-page-sub">{message}</p>}
      <Panel title="Параметры промокода">
        <div className="adm-form-grid">
          <Field label="Код">
            <TextInput
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="WELCOME10"
              disabled={!isNew}
            />
          </Field>
          <Field label="Скидка, basis points" hint="1000 = 10%">
            <TextInput inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </Field>
          <Field label="Бонус, minor units">
            <TextInput inputMode="numeric" value={bonus} onChange={(event) => setBonus(event.target.value)} />
          </Field>
          <Field label="Лимит использований">
            <TextInput
              inputMode="numeric"
              value={maxRedemptions}
              onChange={(event) => setMaxRedemptions(event.target.value)}
              placeholder="Без ограничения"
            />
          </Field>
          {!isNew && (
            <Field label="Статус">
              <label className="adm-toggle">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Промокод активен
              </label>
            </Field>
          )}
        </div>
        <div className="adm-panel-actions" style={{ marginTop: 16 }}>
          <Button variant="primary" busy={busy} onClick={save}>
            {isNew ? "Создать промокод" : "Сохранить"}
          </Button>
        </div>
      </Panel>
      <ActionDialog
        open={confirmArchive}
        title="Архивировать промокод"
        description="Промокод перестанет приниматься."
        fields={[]}
        confirmLabel="Архивировать"
        danger
        busy={busy}
        error={error}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={archive}
      />
    </Page>
  );
}
