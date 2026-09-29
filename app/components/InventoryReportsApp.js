"use client";

import InvPageShell from "@/app/components/InvPageShell";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function InventoryReportsApp() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/reports/stock"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      });
  }, []);

  const k = data?.kpis;

  return (
    <InvPageShell
      title="Inventory reports"
      subtitle="Stock summary and export."
      action={
        <a href={apiUrl("/api/admin/inventory/reports/stock?format=pdf")} className="admin-btn" target="_blank" rel="noreferrer">
          Download PDF
        </a>
      }
    >

      {k ?
        <div className="inv-stat-grid">
          <article className="inv-stat-card inv-stat-blue">
            <div>
              <span>Products</span>
              <strong>{k.total_products}</strong>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-green">
            <div>
              <span>Stock units</span>
              <strong>{k.total_stock_qty}</strong>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-amber">
            <div>
              <span>Low stock</span>
              <strong>{k.low_stock_count}</strong>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-purple">
            <div>
              <span>QR in stock</span>
              <strong>{k.qr_in_stock || 0}</strong>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-sky">
            <div>
              <span>Today sales</span>
              <strong>₹ {formatMoney(k.today_sales)}</strong>
            </div>
          </article>
        </div>
      : null}

      {data?.low_stock?.length ?
        <section className="admin-card">
          <h2>Low stock</h2>
          <ul className="inv-mini-list">
            {data.low_stock.map((p, i) => (
              <li key={i}>
                {p.name} — {p.qty_on_hand} / min {p.min_stock_level}
              </li>
            ))}
          </ul>
        </section>
      : null}
    </InvPageShell>
  );
}
