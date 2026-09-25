"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { archiveAdminCampaign, createAdminCampaign, getAdminCampaign, updateAdminCampaign } from "../../../../lib/api";
import { ActionDialog, Button, Field, Page, Panel, TextInput } from "../../../../components/admin/ui";

export default function AdminCampaignEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = params.id;
  const isNew = campaignId === "new";
  const [name, setName] = useState("");
  const [startParameter, setStartParameter] = useState("");
  const [source, setSource] = useState("");
  const [channel, setChannel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(() => {
    if (isNew || !campaignId) return;
    getAdminCampaign(campaignId)
      .then((campaign) => {
        setName(campaign.name);
        setStartParameter(campaign.startParameter);
        setSource(campaign.source ?? "");
        setChannel(campaign.channel ?? "");
        setIsActive(campaign.isActive);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить кампанию"));
  }, [campaignId, isNew]);
  useEffect(() => load(), [load]);

  const save = async () => {
    if (!name.trim() || (isNew && !startParameter.trim())) {
      setError("Заполните название и start parameter");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await createAdminCampaign({
          name: name.trim(),
          start_parameter: startParameter.trim(),
          source: source.trim() || null,
          channel: channel.trim() || null,
          budget_minor: null,
          currency: "USD",
        });
        router.push("/admin/marketing");
        return;
      }
      await updateAdminCampaign(campaignId, {
        name: name.trim(),
        source: source.trim() || null,
        channel: channel.trim() || null,
        is_active: isActive,
      });
      setMessage("Кампания сохранена");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить кампанию");
    } finally {
      setBusy(false);
    }
  };
  const archive = async (reason: string) => {
    if (reason.trim().length < 3) return;
    setBusy(true);
    try {
      await archiveAdminCampaign(campaignId);
      router.push("/admin/marketing");
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Не удалось архивировать кампанию");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={isNew ? "Новая кампания" : name || "Кампания"}
      description={isNew ? "Start parameter используется для атрибуции регистраций" : `ID ${campaignId}`}
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
      <Panel title="Параметры кампании">
        <div className="adm-form-grid">
          <Field label="Название">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {isNew && (
            <Field label="Start parameter" hint="Латиница, цифры, дефис и подчёркивание">
              <TextInput
                value={startParameter}
                onChange={(event) => setStartParameter(event.target.value)}
                placeholder="spring_sale"
              />
            </Field>
          )}
          <Field label="Источник">
            <TextInput value={source} onChange={(event) => setSource(event.target.value)} placeholder="telegram" />
          </Field>
          <Field label="Канал">
            <TextInput value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="tg_ads" />
          </Field>
          {!isNew && (
            <Field label="Статус">
              <label className="adm-toggle">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                Кампания активна
              </label>
            </Field>
          )}
        </div>
        <div className="adm-panel-actions" style={{ marginTop: 16 }}>
          <Button variant="primary" busy={busy} onClick={save}>
            {isNew ? "Создать кампанию" : "Сохранить"}
          </Button>
        </div>
      </Panel>
      <ActionDialog
        open={confirmArchive}
        title="Архивировать кампанию"
        description="Кампания перестанет учитываться в активной атрибуции."
        fields={[{ name: "reason", label: "Причина", type: "textarea", required: true }]}
        confirmLabel="Архивировать"
        danger
        busy={busy}
        error={error}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={(values) => archive(values.reason ?? "")}
      />
    </Page>
  );
}
