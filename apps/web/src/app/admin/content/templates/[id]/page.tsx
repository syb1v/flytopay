"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createAdminTemplate, getAdminTemplate, updateAdminTemplate } from "../../../../../lib/api";
import { Button, Field, Page, Panel, Select, TextArea, TextInput } from "../../../../../components/admin/ui";

export default function AdminTemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const templateId = params.id;
  const isNew = templateId === "new";
  const [key, setKey] = useState("");
  const [channel, setChannel] = useState("telegram");
  const [locale, setLocale] = useState("ru");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (isNew || !templateId) return;
    getAdminTemplate(templateId)
      .then((template) => {
        setKey(template.key);
        setChannel(template.channel);
        setLocale(template.locale);
        setSubject(template.subject ?? "");
        setBody(template.body);
        setIsActive(template.isActive);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить шаблон"));
  }, [isNew, templateId]);
  useEffect(() => load(), [load]);

  const save = async () => {
    if (!key.trim() || !body.trim()) {
      setError("Заполните ключ и текст");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await createAdminTemplate({ key: key.trim(), channel, locale, subject: subject.trim() || null, body });
        router.push("/admin/content?tab=templates");
        return;
      }
      await updateAdminTemplate(templateId, {
        key: key.trim(),
        channel,
        locale,
        subject: subject.trim() || null,
        body,
        is_active: isActive,
      });
      setMessage("Шаблон сохранён");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить шаблон");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={isNew ? "Новый шаблон" : key || "Шаблон"}
      description={isNew ? "Telegram или email сообщение" : `Канал: ${channel}`}
      backHref="/admin/content?tab=templates"
      backLabel="Шаблоны"
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {message && <p className="adm-page-sub">{message}</p>}
      <Panel title="Параметры шаблона">
        <div className="adm-form-grid">
          <Field label="Ключ" hint="Например, payment_success">
            <TextInput value={key} onChange={(event) => setKey(event.target.value)} disabled={!isNew} />
          </Field>
          <Field label="Канал">
            <Select value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="telegram">Telegram</option>
              <option value="email">Email</option>
            </Select>
          </Field>
          <Field label="Язык">
            <Select value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="Тема (email)">
            <TextInput value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
          <Field label="Статус">
            <label className="adm-toggle">
              <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
              Шаблон активен
            </label>
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Текст">
            <TextArea value={body} onChange={(event) => setBody(event.target.value)} rows={10} />
          </Field>
        </div>
        <div className="adm-panel-actions" style={{ marginTop: 16 }}>
          <Button variant="primary" busy={busy} onClick={save}>
            {isNew ? "Создать шаблон" : "Сохранить"}
          </Button>
        </div>
      </Panel>
    </Page>
  );
}
