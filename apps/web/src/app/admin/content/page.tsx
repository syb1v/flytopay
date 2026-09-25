"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAdminDocuments, getAdminTemplates } from "../../../lib/api";
import type { AdminContentDocument, AdminTemplate } from "../../../lib/api";
import { Badge, Button, Empty, Page, Panel, Tabs } from "../../../components/admin/ui";

const tabs = [
  { key: "documents", label: "FAQ, новости, документы" },
  { key: "templates", label: "Шаблоны сообщений" },
];

export default function AdminContentPage() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "documents";
  const [documents, setDocuments] = useState<AdminContentDocument[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);

  useEffect(() => {
    getAdminDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
    getAdminTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  return (
    <Page
      title="Контент"
      description="Документы, шаблоны и локализованный текст"
      actions={
        tab === "documents" ? (
          <Button href="/admin/content/documents/new" variant="primary">
            Создать документ
          </Button>
        ) : (
          <Button href="/admin/content/templates/new" variant="primary">
            Создать шаблон
          </Button>
        )
      }
    >
      <Tabs base="/admin/content" tabs={tabs} />
      {tab === "documents" && (
        <Panel title="Документы" actions={<Badge tone="info">FAQ и документы показываются в кабинете</Badge>}>
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Название</th>
                  <th>Язык</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.kind === "faq" ? "FAQ" : document.kind === "news" ? "Новость" : "Юр. документ"}</td>
                    <td>
                      <Link className="adm-link" href={`/admin/content/documents/${document.id}`}>
                        {document.title}
                      </Link>
                      <span className="adm-cell-sub">{document.slug}</span>
                    </td>
                    <td>{document.locale.toUpperCase()}</td>
                    <td>
                      <Badge tone={document.isPublished ? "success" : "neutral"}>
                        {document.isPublished ? "Опубликован" : "Черновик"}
                      </Badge>
                    </td>
                    <td>
                      <Link className="adm-link" href={`/admin/content/documents/${document.id}`}>
                        Редактировать →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.length === 0 && <Empty>Документов пока нет.</Empty>}
          </div>
        </Panel>
      )}
      {tab === "templates" && (
        <Panel title="Шаблоны" actions={<Badge tone="neutral">Telegram и email сообщения</Badge>}>
          <div className="adm-table">
            <table>
              <thead>
                <tr>
                  <th>Ключ</th>
                  <th>Канал</th>
                  <th>Язык</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <Link className="adm-link" href={`/admin/content/templates/${template.id}`}>
                        {template.key}
                      </Link>
                    </td>
                    <td>{template.channel}</td>
                    <td>{template.locale.toUpperCase()}</td>
                    <td>
                      <Badge tone={template.isActive ? "success" : "neutral"}>
                        {template.isActive ? "Активен" : "Выключен"}
                      </Badge>
                    </td>
                    <td>
                      <Link className="adm-link" href={`/admin/content/templates/${template.id}`}>
                        Редактировать →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {templates.length === 0 && <Empty>Шаблонов пока нет.</Empty>}
          </div>
        </Panel>
      )}
    </Page>
  );
}
