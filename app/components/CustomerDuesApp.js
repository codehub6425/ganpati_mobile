"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { formatAdminDateFromIso } from "@/lib/format";
import { showError, showSuccess } from "@/lib/swal";
import CompressedPhotoUpload from "./CompressedPhotoUpload";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function CustomerDuesApp() {
  const [dues, setDues] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", payment_method: "cash", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filter === "overdue" ? "?overdue=1" : "";
    const res = await fetch(apiUrl(`/api/admin/customer-dues${qs}`), { credentials: "include" });
    const j = await res.json();
    if (j.ok) {
      setDues(j.dues || []);
      setTotalDue(j.total_due || 0);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDrawer(id) {
    setDrawer(id);
    setDetail(null);
    const res = await fetch(apiUrl(`/api/admin/customer-dues/${id}`), { credentials: "include" });
    const j = await res.json();
    if (j.ok) {
      setDetail(j);
      setPayForm({ amount: String(j.due?.balance_due || ""), payment_method: "cash", notes: "" });
    }
  }

  async function recordPayment(e) {
    e.preventDefault();
    if (!drawer) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/admin/customer-dues/${drawer}/payments`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payForm.amount,
        payment_method: payForm.payment_method,
        notes: payForm.notes || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(data.message || "Payment failed.");
      return;
    }
    showSuccess("Payment recorded.");
    await openDrawer(drawer);
    load();
  }

  async function markDelivered() {
    if (!drawer) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/admin/customer-dues/${drawer}/deliver`), {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      showError(data.message || "Could not mark delivered.");
      return;
    }
    showSuccess("Marked delivered — stock updated.");
    await openDrawer(drawer);
    load();
  }

  return (
    <div className="customer-dues-app">
      <div className="admin-page-head">
        <div>
          <h1>Customer dues</h1>
          <p>Partial pay, pay-later, and advance orders — collect balance and hand over reserved stock.</p>
        </div>
        <span className="admin-count-pill">Due ₹{formatMoney(totalDue)}</span>
      </div>

      <div className="customer-dues-filters">
        <button type="button" className={filter === "open" ? "is-active" : ""} onClick={() => setFilter("open")}>
          Open
        </button>
        <button type="button" className={filter === "overdue" ? "is-active" : ""} onClick={() => setFilter("overdue")}>
          Overdue
        </button>
        <Link href="/admin/accounting" className="inventory-link-btn">
          Daily Accounts
        </Link>
      </div>

      {loading ?
        <p className="admin-muted">Loading…</p>
      : dues.length === 0 ?
        <section className="admin-customer-empty">
          <strong>No open customer dues</strong>
          <p>Use Partial / Pay later / Advance when adding accessories, repair, or inventory sales.</p>
        </section>
      : (
        <ul className="customer-dues-list">
          {dues.map((d) => (
            <li key={d.id}>
              <button type="button" className="customer-dues-row" onClick={() => openDrawer(d.id)}>
                <span className="customer-dues-row-main">
                  <strong>{d.customer_name}</strong>
                  <span>{d.customer_phone}</span>
                </span>
                <span className="customer-dues-row-amt">
                  Due ₹{formatMoney(d.balance_due)}
                  <small> of ₹{formatMoney(d.bill_total)}</small>
                </span>
                <span className={`customer-dues-pill is-${d.due_type}`}>
                  {d.due_type === "advance_order" ? "Advance" : "Credit"}
                </span>
                {d.due_date ?
                  <span className={`customer-dues-date${d.due_date < new Date().toISOString().slice(0, 10) ? " is-overdue" : ""}`}>
                    {formatAdminDateFromIso(d.due_date, { day: "numeric", month: "short" })}
                  </span>
                : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {drawer && detail ?
        <div className="admin-drawer customer-dues-drawer" role="dialog" aria-modal="true">
          <button type="button" className="admin-drawer-backdrop" aria-label="Close" onClick={() => setDrawer(null)} />
          <div className="admin-drawer-panel">
            <div className="admin-drawer-head">
              <h2>{detail.due.customer_name}</h2>
              <button type="button" className="ledger-modal-close" onClick={() => setDrawer(null)}>
                ×
              </button>
            </div>
            <p className="admin-muted">{detail.due.customer_phone}</p>
            <dl className="customer-dues-summary">
              <div>
                <dt>Bill</dt>
                <dd>₹{formatMoney(detail.due.bill_total)}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>₹{formatMoney(detail.due.amount_received)}</dd>
              </div>
              <div>
                <dt>Balance</dt>
                <dd>₹{formatMoney(detail.due.balance_due)}</dd>
              </div>
              {detail.due.due_date ?
                <div>
                  <dt>Due date</dt>
                  <dd>{formatAdminDateFromIso(detail.due.due_date, { day: "numeric", month: "short", year: "numeric" })}</dd>
                </div>
              : null}
            </dl>
            <ul className="customer-dues-lines">
              {detail.lines.map((l) => (
                <li key={l.id}>
                  {l.description} · ₹{formatMoney(l.line_total)}
                  {l.qty > 1 ? ` × ${l.qty}` : ""}
                </li>
              ))}
            </ul>
            <div className="customer-dues-photos">
              <CompressedPhotoUpload
                label="Customer photo"
                uploadUrl={`/api/admin/customer-dues/${drawer}/image`}
                extraFormFields={{ role: "customer" }}
                previewPath={detail.due.customer_photo_key}
                onUploaded={() => openDrawer(drawer)}
              />
              <CompressedPhotoUpload
                label="Product photo"
                uploadUrl={`/api/admin/customer-dues/${drawer}/image`}
                extraFormFields={{ role: "product" }}
                previewPath={detail.due.product_photo_key}
                onUploaded={() => openDrawer(drawer)}
              />
            </div>
            {detail.due.due_type === "advance_order" && detail.due.fulfillment_status !== "delivered" ?
              <button type="button" className="admin-btn" disabled={busy} onClick={markDelivered}>
                Mark delivered (take from stock)
              </button>
            : null}
            {Number(detail.due.balance_due) > 0 ?
              <form className="customer-dues-pay-form" onSubmit={recordPayment}>
                <h3>Record payment</h3>
                <label>
                  <span>Amount ₹</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Method</span>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm((p) => ({ ...p, payment_method: e.target.value }))}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="sbi">SBI</option>
                    <option value="boi">BOI</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <button type="submit" className="admin-btn" disabled={busy}>
                  {busy ? "Saving…" : "Save payment"}
                </button>
              </form>
            : null}
            {detail.payments?.length ?
              <div className="customer-dues-payments">
                <h3>Payments</h3>
                <ul>
                  {detail.payments.map((p) => (
                    <li key={p.id}>
                      ₹{formatMoney(p.amount)} · {formatAdminDateFromIso(p.paid_at, { day: "numeric", month: "short" })}
                    </li>
                  ))}
                </ul>
              </div>
            : null}
          </div>
        </div>
      : null}
    </div>
  );
}
