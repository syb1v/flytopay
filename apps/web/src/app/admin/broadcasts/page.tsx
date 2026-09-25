"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminBroadcasts } from "../../../lib/api";
import type { AdminBroadcast } from "../../../lib/api";
import { Badge, Button, Empty, Page, Panel } from "../../../components/admin/ui";
import { audienceSegmentLabels, broadcastStatusLabels, label } from "../../../lib/adminLabels";

const statusTone = (status: string) =>
  status === "sent"
    ? "success"
    : status === "sent_with_errors"
      ? "danger"
      : status === "queued" || status === "sending"
        ? "warning"
        : "neutral";

export default function AdminBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminBroadcasts()
      .then(setBroadcasts)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить рассылки"));
  }, []);

  return (
    <Page
      title="Рассылки"
      description="Черновики, расписание, сегменты и история доставки"
      actions={
        <Button href="/admin/broadcasts/new" variant="primary">
          Создать рассылку
        </Button>
      }
    >
      {error && <p className="adm-modal-error">{error}</p>}
      <Panel title="Все рассылки">
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>Рассылка</th>
                <th>Сегмент</th>
                <th>Статус</th>
                <th>Доставка</th>
                <th>Дата</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((broadcast) => (
                <tr key={broadcast.id}>
                  <td>
                    <Link className="adm-link" href={`/admin/broadcasts/${broadcast.id}`}>
                      {broadcast.title}
                    </Link>
                  </td>
                  <td>{label(audienceSegmentLabels, broadcast.audience.segment)}</td>
                  <td>
                    <Badge tone={statusTone(broadcast.status)}>{label(broadcastStatusLabels, broadcast.status)}</Badge>
                  </td>
                  <td>
                    {broadcast.sentCount} отправлено / {broadcast.failedCount} ошибок
                  </td>
                  <td>{new Date(broadcast.scheduledAt ?? broadcast.createdAt).toLocaleString("ru-RU")}</td>
                  <td>
                    <Link className="adm-link" href={`/admin/broadcasts/${broadcast.id}`}>
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {broadcasts.length === 0 && <Empty>Рассылок пока нет.</Empty>}
        </div>
      </Panel>
    </Page>
  );
}
