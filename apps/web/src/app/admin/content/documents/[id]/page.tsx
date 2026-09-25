"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  createAdminDocument,
  deleteAdminDocument,
  getAdminDocument,
  updateAdminDocument,
} from "../../../../../lib/api";
import {
  ActionDialog,
  Button,
  Field,
  Page,
  Panel,
  Select,
  TextArea,
  TextInput,
} from "../../../../../components/admin/ui";

export default function AdminDocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = params.id;
  const isNew = documentId === "new";
  const [kind, setKind] = useState("faq");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState("ru");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    if (isNew || !documentId) return;
    getAdminDocument(documentId)
      .then((document) => {
        setKind(document.kind);
        setSlug(document.slug);
        setLocale(document.locale);
        setTitle(document.title);
        setBody(document.body);
        setPublished(document.isPublished);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить документ"));
  }, [documentId, isNew]);
  useEffect(() => load(), [load]);

  const save = async () => {
    if (!slug.trim() || !title.trim() || !body.trim()) {
      setError("Заполните slug, название и текст");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await createAdminDocument({
          kind,
          slug: slug.trim(),
          locale,
          title: title.trim(),
          body,
          is_published: published,
        });
        router.push("/admin/content");
        return;
      }
      await updateAdminDocument(documentId, {
        kind,
        slug: slug.trim(),
        locale,
        title: title.trim(),
        body,
        is_published: published,
      });
      setMessage("Документ сохранён");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить документ");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await deleteAdminDocument(documentId);
      router.push("/admin/content");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить документ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={isNew ? "Новый документ" : title || "Документ"}
      description={isNew ? "FAQ, новость или юридический документ" : `Slug: ${slug}`}
      backHref="/admin/content"
      backLabel="Контент"
      actions={
        !isNew && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Удалить
          </Button>
        )
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      {message && <p className="adm-page-sub">{message}</p>}
      <Panel title="Содержимое">
        <div className="adm-form-grid">
          <Field label="Тип">
            <Select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="faq">FAQ</option>
              <option value="news">Новость</option>
              <option value="legal">Юридический документ</option>
            </Select>
          </Field>
          <Field label="Slug" hint="Используется в URL">
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="faq-payments" />
          </Field>
          <Field label="Язык">
            <Select value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field label="Статус">
            <label className="adm-toggle">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              Опубликован
            </label>
          </Field>
        </div>
        <div className="adm-form-grid" style={{ marginTop: 14 }}>
          <Field label="Название">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Текст">
            <TextArea value={body} onChange={(event) => setBody(event.target.value)} rows={12} />
          </Field>
        </div>
        <div className="adm-panel-actions" style={{ marginTop: 16 }}>
          <Button variant="primary" busy={busy} onClick={save}>
            {isNew ? "Создать документ" : "Сохранить"}
          </Button>
        </div>
      </Panel>
      <ActionDialog
        open={confirmDelete}
        title="Удалить документ"
        description="Действие необратимо."
        confirmLabel="Удалить"
        danger
        busy={busy}
        error={error}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </Page>
  );
}
