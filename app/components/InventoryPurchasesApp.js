"use client";

import InvPageShell from "@/app/components/InvPageShell";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

export default function InventoryPurchasesApp() {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    supplier: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
    product_id: "",
    qty: "1",
    unit_cost: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(apiUrl("/api/admin/inventory/purchases"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPurchases(j.purchases || []);
      });
  }, []);

  useEffect(() => {
    load();
    fetch(apiUrl("/api/admin/inventory/products?status=active"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setProducts(j.products || []);
      });
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/purchases"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier: form.supplier,
          purchase_date: form.purchase_date,
          notes: form.notes,
          lines: [
            {
              product_id: Number(form.product_id),
              qty: Number(form.qty),
              unit_cost: Number(form.unit_cost),
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save.");
        return;
      }
      showSuccess("Purchase recorded.");
      setForm((f) => ({ ...f, supplier: "", notes: "", qty: "1", unit_cost: "" }));
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <InvPageShell title="Purchases" subtitle="Record supplier purchases (quantity products update stock automatically).">
      <form className="admin-card inv-purchase-form" onSubmit={submit}>
        <label>
          Supplier *
          <input required value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
        </label>
        <label>
          Date
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
          />
        </label>
        <label>
          Product *
          <select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
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
          <input type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        </label>
        <label>
          Unit cost ₹
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
          />
        </label>
        <label className="inv-panel-span2">
          Notes
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button type="submit" className="admin-btn" disabled={busy}>
          {busy ? "Saving…" : "Save purchase"}
        </button>
      </form>

      <section className="admin-card">
        <h2>Recent purchases</h2>
        <ul className="inv-purchase-list">
          {purchases.map((p) => (
            <li key={p.id}>
              <strong>{p.supplier}</strong>
              <span>
                {p.purchase_date} · ₹{p.grand_total}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </InvPageShell>
  );
}
