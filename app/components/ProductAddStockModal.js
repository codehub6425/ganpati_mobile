"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

export default function ProductAddStockModal({ product, onClose, onSuccess }) {
  const isSerialized = product?.product_type === "serialized";
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const n = Math.floor(Number(qty));
    if (!Number.isFinite(n) || n <= 0) {
      showError("Enter a valid quantity.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/stock"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          qty: n,
          movement_type: "purchase",
          note: note.trim() || "Stock added from product list",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not update stock.");
        return;
      }
      showSuccess(`Stock updated — ${data.qty_on_hand} on hand.`);
      onSuccess?.(data.product);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const addStockHref = `/admin/inventory/stock/add?product_id=${product.id}`;
  const editHref = `/admin/inventory/products/${product.id}`;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-stock-title">
      <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="admin-modal-card inv-add-stock-modal">
        <div className="admin-modal-head">
          <div>
            <h3 id="add-stock-title">Add stock</h3>
            <p>{product.name}</p>
            <p className="admin-muted">
              Current: <strong>{product.qty_on_hand}</strong> on hand
              {isSerialized ? " · Serialized (QR optional)" : " · Quantity"}
            </p>
          </div>
          <button type="button" className="ledger-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className="inv-add-stock-form" onSubmit={submit}>
          {isSerialized ?
            <p className="admin-muted inv-add-stock-serialized-hint">
              Enter how many you received. You can{" "}
              <Link href={addStockHref} onClick={onClose}>
                scan QR stickers
              </Link>{" "}
              later if you track units by sticker. For items sold by count only, set type to{" "}
              <strong>Quantity</strong> in{" "}
              <Link href={editHref} onClick={onClose}>
                Edit product
              </Link>
              .
            </p>
          : null}
          <label>
            Quantity to add *
            <input
              type="number"
              min="1"
              step="1"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Note (optional)
            <input
              type="text"
              placeholder="e.g. Shop restock"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <p className="admin-muted inv-add-stock-preview">
            New stock after save:{" "}
            <strong>{(Number(product.qty_on_hand) || 0) + (Math.floor(Number(qty)) || 0)}</strong>
          </p>
          <div className="inv-add-stock-foot">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn" disabled={busy}>
              {busy ? "Saving…" : "Add to stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
