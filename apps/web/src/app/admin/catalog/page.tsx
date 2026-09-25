"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAdminProducts } from "../../../lib/api";
import type { AdminProduct } from "../../../lib/api";
import { Badge, Empty, Page, Panel } from "../../../components/admin/ui";

export default function AdminCatalogPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminProducts()
      .then(setProducts)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить продукты"));
  }, []);

  return (
    <Page title="Цены и продукты" description="Карточные продукты 2328, цены выпуска и комиссии">
      {error && <p className="adm-modal-error">{error}</p>}
      <Panel>
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Схема</th>
                <th>Валюта</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Лимит карт</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link className="adm-link" href={`/admin/catalog/${product.id}`}>
                      {product.name}
                    </Link>
                    <span className="adm-cell-sub">{product.code}</span>
                  </td>
                  <td>{product.scheme}</td>
                  <td>{product.currency}</td>
                  <td>{product.cardType ?? "—"}</td>
                  <td>
                    <Badge tone={product.enabled ? "success" : "danger"}>
                      {product.enabled ? "Включён" : "Выключен"}
                    </Badge>
                  </td>
                  <td>{product.maxCardsPerCardholder ?? "—"}</td>
                  <td>
                    <Link className="adm-link" href={`/admin/catalog/${product.id}`}>
                      Редактировать →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <Empty>Продукты не найдены. Выполните синхронизацию каталога 2328.</Empty>}
        </div>
      </Panel>
    </Page>
  );
}
