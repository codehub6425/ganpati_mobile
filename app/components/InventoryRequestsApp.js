"use client";

import InvPageShell from "@/app/components/InvPageShell";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

const STATUSES = ["pending", "available", "purchased", "cancelled"];

export default function InventoryRequestsApp() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    product_requested: "",
    qty: "1",
    expected_price: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const qs = filter ? `?status=${filter}` : "";
    const res = await fetch(apiUrl(`/api/admin/inventory/requests${qs}`), {
      credentials: "include",
    });
    const j = await res.json();
    if (j.ok) setRequests(j.requests || []);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function createRequest(e) {
    e.preventDefault();
    const res = await fetch(apiUrl("/api/admin/inventory/requests"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        qty: Number(form.qty) || 1,
        expected_price: form.expected_price === "" ? null : Number(form.expected_price),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not save.");
      return;
    }
    showSuccess("Request saved.");
    setForm({
      customer_name: "",
      customer_phone: "",
      product_requested: "",
      qty: "1",
      expected_price: "",
      notes: "",
    });
    load();
  }

  async function setStatus(id, status) {
    const res = await fetch(apiUrl(`/api/admin/inventory/requests/${id}`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Update failed.");
      return;
    }
    load();
  }

  return (
    <InvPageShell title="Customer requests" subtitle="Track pending orders and availability for customers.">
      <form className="admin-card inventory-form" onSubmit={createRequest}>
        <h2>New request</h2>
        <div className="inventory-form-grid">
          <label>
            <span>Customer name *</span>
            <input
              required
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            />
          </label>
          <label>
            <span>Mobile</span>
            <input
              maxLength={10}
              value={form.customer_phone}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                }))
              }
            />
          </label>
          <label className="inventory-form-span2">
            <span>Product requested *</span>
            <input
              required
              value={form.product_requested}
              onChange={(e) => setForm((f) => ({ ...f, product_requested: e.target.value }))}
            />
          </label>
          <label>
            <span>Qty</span>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
            />
          </label>
          <label>
            <span>Expected price ₹</span>
            <input
              type="number"
              min="0"
              value={form.expected_price}
              onChange={(e) => setForm((f) => ({ ...f, expected_price: e.target.value }))}
            />
          </label>
          <label className="inventory-form-span2">
            <span>Notes</span>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
        <button type="submit" className="admin-btn">
          Add request
        </button>
      </form>

      <div className="inventory-request-filters">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`inventory-filter-chip${filter === s ? " is-active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <ul className="inventory-request-list">
        {requests.map((r) => (
          <li key={r.id} className="admin-card inventory-request-card">
            <div>
              <strong>{r.product_requested}</strong>
              <span>
                {r.customer_name}
                {r.customer_phone ? ` · ${r.customer_phone}` : ""}
              </span>
              <span>
                Qty {r.qty} · {r.request_date} · <em>{r.status}</em>
              </span>
              {r.notes ? <p>{r.notes}</p> : null}
            </div>
            {r.status === "pending" ?
              <div className="inventory-request-actions">
                <button type="button" onClick={() => setStatus(r.id, "available")}>
                  Available
                </button>
                <button type="button" onClick={() => setStatus(r.id, "purchased")}>
                  Purchased
                </button>
                <button type="button" onClick={() => setStatus(r.id, "cancelled")}>
                  Cancel
                </button>
              </div>
            : null}
          </li>
        ))}
      </ul>
    </InvPageShell>
  );
}
