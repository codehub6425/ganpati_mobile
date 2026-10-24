"use client";

import Link from "next/link";
import InvPageShell from "@/app/components/InvPageShell";
import ListSkeleton from "@/app/components/ListSkeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl, productImageSrc } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function emptyLine() {
  return { product_id: "", qty: "1", unit_cost: "" };
}

function statusPill(status) {
  if (status === "paid") return { text: "Paid", className: "is-ok" };
  if (status === "partial") return { text: "Partial", className: "is-warn" };
  return { text: "Due", className: "is-danger" };
}

export default function InventoryPurchasesApp() {
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    supplier: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    vendor_invoice_no: "",
    notes: "",
    lines: [emptyLine()],
  });
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const grandTotal = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const cost = Number(line.unit_cost) || 0;
      return sum + qty * cost;
    }, 0);
  }, [form.lines]);

  const load = useCallback(() => {
    setLoadingPurchases(true);
    fetch(apiUrl("/api/admin/inventory/purchases"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPurchases(j.purchases || []);
      })
      .finally(() => setLoadingPurchases(false));
  }, []);

  useEffect(() => {
    load();
    fetch(apiUrl("/api/admin/inventory/products?status=active"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setProducts(j.products || []);
      });
  }, [load]);

  function updateLine(index, patch) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  }

  function removeLine(index) {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((_, i) => i !== index),
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const lines = form.lines
        .filter((l) => l.product_id)
        .map((l) => ({
          product_id: Number(l.product_id),
          qty: Number(l.qty),
          unit_cost: Number(l.unit_cost),
        }));
      const res = await fetch(apiUrl("/api/admin/inventory/purchases"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: form.supplier,
          purchase_date: form.purchase_date,
          due_date: form.due_date || undefined,
          vendor_invoice_no: form.vendor_invoice_no,
          notes: form.notes,
          lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save.");
        return;
      }
      showSuccess("Purchase recorded.");
      setForm({
        supplier: "",
        purchase_date: new Date().toISOString().slice(0, 10),
        due_date: "",
        vendor_invoice_no: "",
        notes: "",
        lines: [emptyLine()],
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inventory/purchases/${id}`), { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not load.");
        return;
      }
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
  }

  const hasSerializedHint = detail?.lines?.some((l) => l.product_type === "serialized");

  return (
    <InvPageShell
      title="Purchases"
      subtitle="Record supplier bills (multi-line). Quantity products update stock; serialized items use Add stock (QR) after purchase."
      action={
        <Link href="/admin/inventory/products/new" className="admin-btn admin-btn-secondary" target="_blank">
          + Add product
        </Link>
      }
    >
      <form id="record-purchase" className="admin-card inv-purchase-form" onSubmit={submit}>
        <h2>Record purchase</h2>
        {products.length === 0 ?
          <p className="admin-muted">
            Add products first.{" "}
            <Link href="/admin/inventory/products/new" target="_blank">
              Create a product
            </Link>
          </p>
        : null}
        <div className="inv-purchase-form-grid">
          <label>
            Supplier *
            <input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </label>
          <label>
            Purchase date
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </label>
          <label>
            Due date (optional)
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </label>
          <label>
            Vendor invoice no.
            <input
              value={form.vendor_invoice_no}
              onChange={(e) => setForm({ ...form, vendor_invoice_no: e.target.value })}
            />
          </label>
          <label className="inv-panel-span2">
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>

        <div className="inv-purchase-lines">
          <div className="inv-purchase-lines-head">
            <span>Line items</span>
            <strong>Total ₹{formatMoney(grandTotal)}</strong>
          </div>
          {form.lines.map((line, index) => (
            <div key={index} className="inv-purchase-line-row">
              <label>
                Product *
                <select
                  required
                  value={line.product_id}
                  onChange={(e) => updateLine(index, { product_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.product_type})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Qty
                <input
                  type="number"
                  min="1"
                  value={line.qty}
                  onChange={(e) => updateLine(index, { qty: e.target.value })}
                />
              </label>
              <label>
                Unit cost ₹
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={line.unit_cost}
                  onChange={(e) => updateLine(index, { unit_cost: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="inv-text-btn is-danger inv-purchase-line-remove"
                onClick={() => removeLine(index)}
                disabled={form.lines.length <= 1}
                aria-label="Remove line"
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="inv-text-btn" onClick={addLine}>
            + Add line
          </button>
        </div>

        <p className="admin-muted inv-purchase-serialized-hint">
          Serialized (QR) products: stock increases when you link stickers in{" "}
          <Link href="/admin/inventory/stock/add">Add stock</Link>.
        </p>

        <button type="submit" className="admin-btn" disabled={busy || products.length === 0}>
          {busy ? "Saving…" : "Save purchase"}
        </button>
      </form>

      <section className="admin-card">
        <h2>Recent purchases</h2>
        {loadingPurchases ?
          <ListSkeleton variant="rows" rows={5} />
        : purchases.length === 0 ?
          <p className="admin-muted">No purchases yet.</p>
        : (
          <ul className="inv-purchase-list">
            {purchases.map((p) => {
              const st = statusPill(p.payment_status);
              return (
                <li key={p.id}>
                  <button type="button" className="inv-purchase-list-btn" onClick={() => openDetail(p.id)}>
                    <strong>{p.supplier}</strong>
                    <span>
                      {p.purchase_date} · ₹{formatMoney(p.grand_total)}
                      {Number(p.balance_due) > 0 ? ` · Due ₹${formatMoney(p.balance_due)}` : ""}
                    </span>
                    <span className={`inv-status-pill ${st.className}`}>{st.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {detailId ?
        <div className="admin-modal inv-purchase-detail" role="dialog" aria-modal="true">
          <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={closeDetail} />
          <div className="admin-modal-card">
            <div className="admin-modal-head">
              <div>
                <h3>Purchase #{detailId}</h3>
                {detail?.purchase ?
                  <p>
                    {detail.purchase.supplier} · {detail.purchase.purchase_date}
                  </p>
                : null}
              </div>
              <button type="button" className="ledger-modal-close" onClick={closeDetail} aria-label="Close">
                ×
              </button>
            </div>
            {detailLoading ?
              <ListSkeleton variant="rows" rows={4} />
            : detail ?
              <div className="inv-purchase-detail-body">
                <p>
                  Total ₹{formatMoney(detail.purchase.grand_total)}
                  {Number(detail.purchase.balance_due) > 0 ?
                    ` · Due ₹${formatMoney(detail.purchase.balance_due)}`
                  : " · Paid"}
                </p>
                {hasSerializedHint ?
                  <p className="admin-muted">
                    Includes serialized items — use{" "}
                    <Link href="/admin/inventory/stock/add">Add stock (QR)</Link> to receive units.
                  </p>
                : null}
                <ul className="inv-purchase-detail-lines">
                  {detail.lines.map((l) => (
                    <li key={l.id}>
                      {l.product_name} × {l.qty} @ ₹{formatMoney(l.unit_cost)} = ₹{formatMoney(l.line_total)}
                      {l.product_type === "serialized" ? " (QR)" : ""}
                    </li>
                  ))}
                </ul>
                {detail.purchase.bill_url ?
                  <a
                    href={productImageSrc(detail.purchase.bill_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-btn admin-btn-secondary"
                  >
                    View bill
                  </a>
                : null}
                {detail.purchase.supplier_id && Number(detail.purchase.balance_due) > 0 ?
                  <Link href="/admin/inventory/vendors" className="admin-btn">
                    Pay vendor
                  </Link>
                : null}
              </div>
            : null}
          </div>
        </div>
      : null}
    </InvPageShell>
  );
}
