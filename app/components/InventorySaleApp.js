"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError } from "@/lib/swal";
import InvPageShell from "@/app/components/InvPageShell";
import InventorySaleInvoice from "./InventorySaleInvoice";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function InventorySaleApp() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState([]);
  const [cartDiscount, setCartDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/products?for_sale=1"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setProducts(j.products || []);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [products, search]);

  function addLine(product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product_id === product.id ? { ...l, qty: Math.min(l.qty + 1, product.qty_on_hand) } : l
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          qty_on_hand: product.qty_on_hand,
          unit_mrp: product.mrp,
          unit_selling_price: product.selling_price,
          qty: 1,
          line_discount: 0,
        },
      ];
    });
  }

  function updateLine(productId, patch) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product_id !== productId) return l;
        const next = { ...l, ...patch };
        if (next.qty > next.qty_on_hand) next.qty = next.qty_on_hand;
        if (next.qty < 1) return null;
        return next;
      }).filter(Boolean)
    );
  }

  const subtotal = lines.reduce(
    (s, l) => s + l.unit_selling_price * l.qty - (Number(l.line_discount) || 0),
    0
  );
  const cartDisc = Math.max(0, Number(cartDiscount) || 0);
  const grandTotal = Math.max(0, subtotal - cartDisc);

  async function submitSale(e) {
    e.preventDefault();
    if (!lines.length) {
      showError("Add at least one product.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/sales"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            product_id: l.product_id,
            qty: l.qty,
            line_discount: l.line_discount || 0,
          })),
          cart_discount: cartDisc,
          payment_method: paymentMethod,
          customer_phone: customerPhone || undefined,
          customer_name: customerName || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Sale failed.");
        return;
      }
      setCompletedSale(data.sale);
    } finally {
      setBusy(false);
    }
  }

  if (completedSale) {
    return (
      <div className="inventory-app">
        <InventorySaleInvoice sale={completedSale} />
        <div className="inventory-sale-done-actions">
          <button type="button" className="admin-btn" onClick={() => window.print()}>
            Print invoice
          </button>
          <Link href="/admin/inventory/sales/new" className="admin-btn admin-btn-secondary">
            New sale
          </Link>
          <Link href="/admin/inventory" className="inventory-link-btn">
            Inventory home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <InvPageShell title="New sale" subtitle="Stock and Daily Accounts update automatically when you complete a sale.">
      <div className="inventory-sale-layout">
        <section className="admin-card inventory-sale-picker">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="inventory-sale-product-picks">
            {filtered.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addLine(p)}>
                  <strong>{p.name}</strong>
                  <span>
                    ₹{formatMoney(p.selling_price)} · {p.qty_on_hand} in stock
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <form className="admin-card inventory-sale-cart" onSubmit={submitSale}>
          <h2>Cart</h2>
          {lines.length === 0 ?
            <p className="admin-empty">Tap a product to add.</p>
          : (
            <ul className="inventory-cart-lines">
              {lines.map((l) => (
                <li key={l.product_id}>
                  <div>
                    <strong>{l.name}</strong>
                    <span>
                      MRP ₹{formatMoney(l.unit_mrp)} · Sell ₹{formatMoney(l.unit_selling_price)}
                    </span>
                  </div>
                  <div className="inventory-cart-line-controls">
                    <input
                      type="number"
                      min="1"
                      max={l.qty_on_hand}
                      value={l.qty}
                      onChange={(e) => updateLine(l.product_id, { qty: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Disc ₹"
                      value={l.line_discount || ""}
                      onChange={(e) =>
                        updateLine(l.product_id, { line_discount: Number(e.target.value) || 0 })
                      }
                    />
                    <button type="button" onClick={() => updateLine(l.product_id, { qty: 0 })}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <label>
            <span>Cart discount ₹</span>
            <input
              type="number"
              min="0"
              value={cartDiscount}
              onChange={(e) => setCartDiscount(e.target.value)}
            />
          </label>
          <label>
            <span>Payment</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="sbi">SBI</option>
              <option value="boi">BOI</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>Customer mobile</span>
            <input
              type="tel"
              maxLength={10}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <label>
            <span>Customer name</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label>
            <span>Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="inventory-cart-totals">
            <p>Subtotal: ₹{formatMoney(subtotal)}</p>
            {cartDisc > 0 ? <p>Discount: −₹{formatMoney(cartDisc)}</p> : null}
            <p className="inventory-cart-grand">
              <strong>Total: ₹{formatMoney(grandTotal)}</strong>
            </p>
          </div>

          <button type="submit" className="admin-btn" disabled={busy || !lines.length}>
            {busy ? "Processing…" : "Complete sale"}
          </button>
        </form>
      </div>
    </InvPageShell>
  );
}
