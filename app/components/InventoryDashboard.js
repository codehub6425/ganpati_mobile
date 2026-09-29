"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

const MODULES = [
  {
    href: "/admin/inventory/products",
    title: "Products",
    desc: "Catalog, pricing, stock levels, add & edit",
    icon: "📦",
    accent: "blue",
  },
  {
    href: "/admin/inventory/categories",
    title: "Categories",
    desc: "Organize products by category",
    icon: "🏷️",
    accent: "purple",
  },
  {
    href: "/admin/inventory/qr",
    title: "QR management",
    desc: "Generate batches and print sticker PDFs",
    icon: "▦",
    accent: "sky",
  },
  {
    href: "/admin/inventory/stock/add",
    title: "Add stock",
    desc: "Scan QR and link to serialized products",
    icon: "➕",
    accent: "green",
  },
  {
    href: "/admin/inventory/stock",
    title: "Stock (QR)",
    desc: "All sticker codes and link status",
    icon: "📋",
    accent: "green",
  },
  {
    href: "/admin/inventory/scan",
    title: "Scan",
    desc: "Lookup, sell, finance, or return by QR",
    icon: "📷",
    accent: "blue",
  },
  {
    href: "/admin/inventory/sales/new",
    title: "Sales",
    desc: "Counter sale with cart and invoice",
    icon: "₹",
    accent: "amber",
  },
  {
    href: "/admin/inventory/purchases",
    title: "Purchases",
    desc: "Supplier purchases and stock-in",
    icon: "🛒",
    accent: "purple",
  },
  {
    href: "/admin/inventory/requests",
    title: "Requests",
    desc: "Customer product requests",
    icon: "💬",
    accent: "amber",
  },
  {
    href: "/admin/inventory/reports",
    title: "Reports",
    desc: "Stock summary and PDF export",
    icon: "📊",
    accent: "sky",
  },
];

export default function InventoryDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/dashboard"), { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) setError(json.message || "Could not load.");
        else setData(json);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis;
  const showSetup = k && Number(k.total_products) === 0;

  return (
    <div className="inventory-app inv-dashboard-page">
      <header className="inv-hub-header">
        <div>
          <h1>Inventory dashboard</h1>
          <p>Overview of stock, sales, QR workflow, and quick access to every inventory tool.</p>
        </div>
        <div className="inv-dash-head-actions">
          <Link href="/admin/inventory/sales/new" className="admin-btn">
            New sale
          </Link>
          <Link href="/admin/inventory/products" className="admin-btn admin-btn-secondary">
            Product inventory
          </Link>
        </div>
      </header>

      {error ?
        <p className="admin-empty">{error}</p>
      : null}
      {loading && !k ?
        <p className="admin-empty">Loading dashboard…</p>
      : null}

      {k ?
        <>
          <div className="inv-stat-grid inv-kpi-row--six inv-dash-kpi-primary">
            <article className="inv-stat-card inv-stat-blue">
              <div className="inv-stat-icon" aria-hidden="true">
                📦
              </div>
              <div>
                <span>Total products</span>
                <strong>{k.total_products}</strong>
                <small>Active catalog</small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-green">
              <div className="inv-stat-icon" aria-hidden="true">
                ✓
              </div>
              <div>
                <span>Total stock</span>
                <strong>{formatMoney(k.total_stock_qty)}</strong>
                <small>Units on hand</small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-amber">
              <div className="inv-stat-icon" aria-hidden="true">
                ⚠
              </div>
              <div>
                <span>Low stock</span>
                <strong>{k.low_stock_count}</strong>
                <small>
                  <Link href="/admin/inventory/products?low_stock=1">View products</Link>
                </small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-red">
              <div className="inv-stat-icon" aria-hidden="true">
                ✕
              </div>
              <div>
                <span>Out of stock</span>
                <strong>{k.out_of_stock_count}</strong>
                <small>Need restock</small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-sky">
              <div className="inv-stat-icon" aria-hidden="true">
                ₹
              </div>
              <div>
                <span>Today&apos;s sales</span>
                <strong>₹ {formatMoney(k.today_sales)}</strong>
                <small>
                  {k.today_sale_count} sale{k.today_sale_count === 1 ? "" : "s"}
                </small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-purple">
              <div className="inv-stat-icon" aria-hidden="true">
                ◈
              </div>
              <div>
                <span>Stock value</span>
                <strong>₹ {formatMoney(k.stock_value)}</strong>
                <small>At purchase price</small>
              </div>
            </article>
          </div>

          <div className="inv-stat-grid inv-dash-kpi-secondary">
            <article className="inv-stat-card inv-stat-green">
              <div className="inv-stat-icon" aria-hidden="true">
                ↑
              </div>
              <div>
                <span>Today&apos;s profit</span>
                <strong>₹ {formatMoney(k.today_profit)}</strong>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-amber">
              <div className="inv-stat-icon" aria-hidden="true">
                💬
              </div>
              <div>
                <span>Pending requests</span>
                <strong>{k.pending_requests}</strong>
                <small>
                  <Link href="/admin/inventory/requests">Open requests</Link>
                </small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-sky">
              <div className="inv-stat-icon" aria-hidden="true">
                ▦
              </div>
              <div>
                <span>QR unassigned</span>
                <strong>{k.qr_unassigned ?? 0}</strong>
                <small>
                  <Link href="/admin/inventory/qr">QR management</Link>
                </small>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-green">
              <div className="inv-stat-icon" aria-hidden="true">
                ✓
              </div>
              <div>
                <span>QR in stock</span>
                <strong>{k.qr_in_stock ?? 0}</strong>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-red">
              <div className="inv-stat-icon" aria-hidden="true">
                ◉
              </div>
              <div>
                <span>QR sold</span>
                <strong>{k.qr_sold ?? 0}</strong>
              </div>
            </article>
            <article className="inv-stat-card inv-stat-purple">
              <div className="inv-stat-icon" aria-hidden="true">
                %
              </div>
              <div>
                <span>On discount</span>
                <strong>{k.discount_products_count}</strong>
              </div>
            </article>
          </div>
        </>
      : null}

      {showSetup ?
        <section className="admin-card inv-setup-guide">
          <h2>Get started with QR inventory</h2>
          <ol>
            <li>
              <Link href="/admin/inventory/qr">Generate &amp; print QR stickers</Link>
            </li>
            <li>
              <Link href="/admin/inventory/products">Create a serialized product</Link>
            </li>
            <li>
              <Link href="/admin/inventory/stock/add">Scan to link stock</Link>
            </li>
            <li>
              <Link href="/admin/inventory/scan">Scan to sell</Link>
            </li>
          </ol>
        </section>
      : null}

      <section className="inv-dash-modules" aria-label="Inventory sections">
        <h2 className="inv-dash-section-title">Go to</h2>
        <div className="inv-dash-module-grid">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href} className={`inv-dash-module inv-dash-module--${m.accent}`}>
              <span className="inv-dash-module-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span className="inv-dash-module-text">
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
              <span className="inv-dash-module-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="inv-dash-alerts">
        {data?.low_stock?.length ?
          <section className="admin-card inv-bottom-card">
            <header className="inv-bottom-head">
              <h2>Low stock</h2>
              <Link href="/admin/inventory/products?low_stock=1">View all</Link>
            </header>
            <ul className="inv-mini-list">
              {data.low_stock.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/inventory/products/${p.id}`} className="inv-mini-main">
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.qty_on_hand} left · min {p.min_stock_level}
                      </small>
                    </span>
                  </Link>
                  <span className="inventory-badge is-warn">Low</span>
                </li>
              ))}
            </ul>
          </section>
        : null}

        {data?.out_of_stock?.length ?
          <section className="admin-card inv-bottom-card">
            <header className="inv-bottom-head">
              <h2>Out of stock</h2>
              <Link href="/admin/inventory/products">Products</Link>
            </header>
            <ul className="inv-mini-list">
              {data.out_of_stock.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/inventory/products/${p.id}`} className="inv-mini-main">
                    <span>
                      <strong>{p.name}</strong>
                      <small>0 in stock</small>
                    </span>
                  </Link>
                  <span className="inventory-badge is-danger">Out</span>
                </li>
              ))}
            </ul>
          </section>
        : null}
      </div>
    </div>
  );
}
