"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import QrCodeScanner from "@/app/components/QrCodeScanner";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function InventoryScanDetailApp() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [code, setCode] = useState(initialCode);
  const [data, setData] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    payment_method: "cash",
    customer_phone: "",
    customer_name: "",
  });
  const [financeForm, setFinanceForm] = useState({
    finance_down_payment: "",
    finance_tenure_months: "6",
    customer_phone: "",
    customer_name: "",
    payment_method: "cash",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (c) => {
    const raw = String(c || "").trim();
    if (!raw) return;
    setCode(raw.toUpperCase());
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/lookup?code=${encodeURIComponent(raw)}`), {
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) {
      showError(json.message || "Not found.");
      setData(null);
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    if (initialCode) load(initialCode);
  }, [initialCode, load]);

  async function markSold(saleMode = "cash", extra = {}) {
    const ok = await confirmAction({
      title: saleMode === "finance" ? "Sell on finance?" : "Mark as sold?",
      confirmText: "Confirm sale",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/qr/sell"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          sale_mode: saleMode,
          payment_method: extra.payment_method || "cash",
          customer_phone: extra.customer_phone,
          customer_name: extra.customer_name,
          finance_down_payment: extra.finance_down_payment,
          finance_tenure_months: extra.finance_tenure_months,
          finance_notes: extra.finance_notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.message || "Sale failed.");
        return;
      }
      showSuccess("Sale recorded.");
      setFinanceOpen(false);
      load(code);
    } finally {
      setBusy(false);
    }
  }

  async function processReturn(restock) {
    const ok = await confirmAction({ title: restock ? "Return and restock?" : "Mark as void?" });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/qr/return"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, restock }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.message || "Return failed.");
        return;
      }
      showSuccess(restock ? "Unit restocked." : "Unit voided.");
      load(code);
    } finally {
      setBusy(false);
    }
  }

  const unit = data?.unit;
  const product = data?.product;
  const actions = data?.actions;

  return (
    <InvPageShell title="Scan product" subtitle="Scan any sticker to view details, sell, or return.">
      <div className="inv-scan-detail-page">
      <section className="admin-card inv-scan-panel">
        <div className="inv-scan-code-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GMP-000125"
            onKeyDown={(e) => e.key === "Enter" && load(code)}
          />
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => load(code)}>
            Load
          </button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setUseCamera((v) => !v)}>
            Camera
          </button>
        </div>
        {useCamera ?
          <QrCodeScanner
            onScan={(t) => {
              load(t);
              setUseCamera(false);
            }}
            active={useCamera}
          />
        : null}
      </section>

      {unit ?
        <article className="admin-card inv-scan-detail-card">
          <div className="inv-scan-detail-head">
            <span className={`inv-status-pill inv-qr-${unit.status}`}>{unit.status.replace("_", " ")}</span>
            <strong>{unit.code}</strong>
          </div>
          {product ?
            <>
              {product.image_url ?
                <img src={product.image_url} alt="" className="inv-scan-detail-img" />
              : null}
              <h2>{product.name}</h2>
              <p>
                {product.category_name}
                {product.brand ? ` · ${product.brand}` : ""}
              </p>
              <p>
                SKU {product.sku || "—"} · Stock {product.qty_on_hand}
              </p>
              <p className="inv-scan-prices">
                MRP ₹{formatMoney(product.mrp)} · Sell ₹{formatMoney(product.selling_price)}
              </p>
              {unit.warranty_expires_at ?
                <p>Warranty until {unit.warranty_expires_at}</p>
              : null}
            </>
          : (
            <p className="admin-empty">Sticker not linked to a product yet.</p>
          )}

          <div className="inv-scan-actions">
            {actions?.can_link ?
              <Link href={`/admin/inventory/stock/add?code=${encodeURIComponent(unit.code)}`} className="admin-btn">
                Link / add stock
              </Link>
            : null}
            {actions?.can_sell ?
              <>
                <button type="button" className="admin-btn inv-btn-sold" disabled={busy} onClick={() => markSold("cash", saleForm)}>
                  Mark as sold
                </button>
                <button type="button" className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => setFinanceOpen(true)}>
                  Sell on finance
                </button>
              </>
            : null}
            {actions?.can_return ?
              <>
                <button type="button" className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => processReturn(true)}>
                  Return & restock
                </button>
                <button type="button" className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => processReturn(false)}>
                  Return (void)
                </button>
              </>
            : null}
            {product ?
              <Link href={`/admin/inventory/products/${product.id}`} className="admin-btn admin-btn-secondary">
                Edit product
              </Link>
            : null}
          </div>

          {financeOpen ?
            <form
              className="inv-finance-form"
              onSubmit={(e) => {
                e.preventDefault();
                markSold("finance", {
                  ...financeForm,
                  finance_down_payment: Number(financeForm.finance_down_payment) || 0,
                  finance_tenure_months: Number(financeForm.finance_tenure_months) || 6,
                  finance_notes: "Finance sale from QR scan",
                });
              }}
            >
              <h3>Finance sale</h3>
              <label>
                Down payment ₹
                <input
                  type="number"
                  min="0"
                  value={financeForm.finance_down_payment}
                  onChange={(e) => setFinanceForm({ ...financeForm, finance_down_payment: e.target.value })}
                />
              </label>
              <label>
                Tenure (months)
                <input
                  type="number"
                  min="1"
                  value={financeForm.finance_tenure_months}
                  onChange={(e) => setFinanceForm({ ...financeForm, finance_tenure_months: e.target.value })}
                />
              </label>
              <label>
                Customer phone
                <input
                  value={financeForm.customer_phone}
                  onChange={(e) => setFinanceForm({ ...financeForm, customer_phone: e.target.value })}
                />
              </label>
              <label>
                Customer name
                <input
                  value={financeForm.customer_name}
                  onChange={(e) => setFinanceForm({ ...financeForm, customer_name: e.target.value })}
                />
              </label>
              <button type="submit" className="admin-btn" disabled={busy}>
                Confirm finance sale
              </button>
            </form>
          : null}

          {data?.movements?.length ?
            <section className="inv-scan-history">
              <h3>Stock history</h3>
              <ul>
                {data.movements.map((m) => (
                  <li key={m.id}>
                    {m.movement_type} {m.qty_delta > 0 ? "+" : ""}
                    {m.qty_delta} · {new Date(m.created_at).toLocaleString("en-IN")} · {m.note || ""}
                  </li>
                ))}
              </ul>
            </section>
          : null}
        </article>
      : null}
      </div>
    </InvPageShell>
  );
}
