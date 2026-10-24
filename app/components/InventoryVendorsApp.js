"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import ListSkeleton from "@/app/components/ListSkeleton";
import { apiUrl, productImageSrc } from "@/lib/basePath";
import { PAYMENT_METHODS } from "@/lib/ledger";
import { showError, showSuccess } from "@/lib/swal";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function statusPill(status) {
  if (status === "paid") return { text: "Paid", className: "is-ok" };
  if (status === "partial") return { text: "Partial", className: "is-warn" };
  return { text: "Due", className: "is-danger" };
}

export default function InventoryVendorsApp() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [payForm, setPayForm] = useState({
    purchase_id: "",
    amount: "",
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    notes: "",
  });
  const [payBusy, setPayBusy] = useState(false);
  const [billBusy, setBillBusy] = useState(false);

  const loadSuppliers = useCallback(() => {
    setLoading(true);
    fetch(apiUrl("/api/admin/inventory/suppliers"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSuppliers(j.suppliers || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  async function openSupplier(id) {
    setSelectedId(id);
    setLedger(null);
    setLedgerLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inventory/suppliers/${id}/ledger`), {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not load vendor.");
        return;
      }
      setLedger(data);
      const openPurchase = (data.purchases || []).find((p) => Number(p.balance_due) > 0);
      setPayForm((f) => ({
        ...f,
        purchase_id: openPurchase ? String(openPurchase.id) : "",
        amount: openPurchase ? String(openPurchase.balance_due) : "",
      }));
    } finally {
      setLedgerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setLedger(null);
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!selectedId) return;
    setPayBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inventory/suppliers/${selectedId}/payments`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_id: payForm.purchase_id || null,
          amount: Number(payForm.amount),
          paid_at: payForm.paid_at,
          payment_method: payForm.payment_method,
          notes: payForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save payment.");
        return;
      }
      showSuccess("Payment recorded and posted to Daily Accounts.");
      loadSuppliers();
      await openSupplier(selectedId);
    } finally {
      setPayBusy(false);
    }
  }

  async function uploadBill(purchaseId, file) {
    if (!file) return;
    setBillBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl(`/api/admin/inventory/purchases/${purchaseId}/bill`), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Upload failed.");
        return;
      }
      showSuccess("Bill uploaded.");
      if (selectedId) await openSupplier(selectedId);
    } finally {
      setBillBusy(false);
    }
  }

  const dueOnly = suppliers.filter((s) => Number(s.total_due) > 0);

  return (
    <InvPageShell
      title="Vendor dues"
      subtitle="Track supplier bills, upload invoices, and pay vendors — payments sync to Daily Accounts."
      action={
        <Link href="/admin/inventory/purchases#record-purchase" className="admin-btn">
          Record purchase
        </Link>
      }
    >
      {loading ?
        <ListSkeleton variant="rows" rows={8} />
      : dueOnly.length === 0 && suppliers.length === 0 ?
        <section className="admin-card inv-empty-vendors">
          <p>No vendors yet. Record a purchase to create a supplier.</p>
          <Link href="/admin/inventory/purchases#record-purchase" className="admin-btn">
            Record purchase
          </Link>
        </section>
      : (
        <section className="admin-card">
          <h2>Suppliers</h2>
          <ul className="inv-vendor-list">
            {suppliers.map((s) => (
              <li key={s.id}>
                <button type="button" className="inv-vendor-row" onClick={() => openSupplier(s.id)}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.open_bills} open bill{s.open_bills === 1 ? "" : "s"}
                      {s.phone ? ` · ${s.phone}` : ""}
                    </small>
                  </span>
                  <span className={`inv-vendor-due${Number(s.total_due) > 0 ? " is-warn" : ""}`}>
                    {Number(s.total_due) > 0 ? `Due ₹${formatMoney(s.total_due)}` : "Clear"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedId ?
        <div className="admin-modal inv-vendor-drawer" role="dialog" aria-modal="true">
          <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={closeDrawer} />
          <div className="admin-modal-card inv-vendor-drawer-card">
            <div className="admin-modal-head">
              <div>
                <h3>{ledger?.supplier?.name || "Vendor"}</h3>
                <p>
                  Total due:{" "}
                  <strong>₹{formatMoney(ledger?.total_due ?? 0)}</strong>
                </p>
              </div>
              <button type="button" className="ledger-modal-close" onClick={closeDrawer} aria-label="Close">
                ×
              </button>
            </div>

            {ledgerLoading ?
              <ListSkeleton variant="rows" rows={5} />
            : ledger ?
              <div className="inv-vendor-drawer-body">
                <section>
                  <h4>Purchase bills</h4>
                  <ul className="inv-vendor-purchase-list">
                    {ledger.purchases.map((p) => {
                      const st = statusPill(p.payment_status);
                      return (
                        <li key={p.id} className="inv-vendor-purchase-item">
                          <div className="inv-vendor-purchase-head">
                            <span>
                              <strong>#{p.id}</strong> · {p.purchase_date}
                              {p.vendor_invoice_no ? ` · Inv ${p.vendor_invoice_no}` : ""}
                            </span>
                            <span className={`inv-status-pill ${st.className}`}>{st.text}</span>
                          </div>
                          <p className="inv-vendor-purchase-amt">
                            ₹{formatMoney(p.grand_total)}
                            {Number(p.balance_due) > 0 ?
                              <span className="is-warn"> · Due ₹{formatMoney(p.balance_due)}</span>
                            : null}
                          </p>
                          <div className="inv-vendor-purchase-actions">
                            {p.bill_url ?
                              <a href={productImageSrc(p.bill_url)} target="_blank" rel="noreferrer" className="inv-text-btn">
                                View bill
                              </a>
                            : null}
                            <label className="inv-text-btn inv-bill-upload-label">
                              {billBusy ? "Uploading…" : "Upload bill"}
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                hidden
                                disabled={billBusy}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  uploadBill(p.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {Number(p.balance_due) > 0 ?
                              <button
                                type="button"
                                className="inv-text-btn"
                                onClick={() =>
                                  setPayForm((f) => ({
                                    ...f,
                                    purchase_id: String(p.id),
                                    amount: String(p.balance_due),
                                  }))
                                }
                              >
                                Pay this bill
                              </button>
                            : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {ledger.payments?.length ?
                  <section>
                    <h4>Payment history</h4>
                    <ul className="inv-vendor-pay-history">
                      {ledger.payments.map((pay) => (
                        <li key={pay.id}>
                          {pay.paid_at} · ₹{formatMoney(pay.amount)}
                          {pay.purchase_id ? ` · Purchase #${pay.purchase_id}` : ""}
                          {pay.ledger_entry_id ?
                            <Link href="/admin/accounting" className="inv-text-btn">
                              In Daily Accounts
                            </Link>
                          : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                : null}

                <form className="inv-vendor-pay-form admin-card" onSubmit={submitPayment}>
                  <h4>Record payment</h4>
                  <p className="admin-muted inv-vendor-pay-hint">
                    Posts as <strong>Payment given</strong> in Daily Accounts for the date below.
                  </p>
                  <label>
                    Apply to bill
                    <select
                      value={payForm.purchase_id}
                      onChange={(e) => {
                        const id = e.target.value;
                        const purchase = ledger.purchases.find((p) => String(p.id) === id);
                        setPayForm((f) => ({
                          ...f,
                          purchase_id: id,
                          amount: purchase ? String(purchase.balance_due) : f.amount,
                        }));
                      }}
                    >
                      <option value="">General payment (no bill)</option>
                      {ledger.purchases
                        .filter((p) => Number(p.balance_due) > 0)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.id} · Due ₹{formatMoney(p.balance_due)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Amount ₹ *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    />
                  </label>
                  <label>
                    Paid on *
                    <input
                      type="date"
                      required
                      value={payForm.paid_at}
                      onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })}
                    />
                  </label>
                  <label>
                    Method
                    <select
                      value={payForm.payment_method}
                      onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes
                    <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
                  </label>
                  <button type="submit" className="admin-btn" disabled={payBusy}>
                    {payBusy ? "Saving…" : "Record payment"}
                  </button>
                </form>
              </div>
            : null}
          </div>
        </div>
      : null}
    </InvPageShell>
  );
}
