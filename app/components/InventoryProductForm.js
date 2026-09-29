"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

const EMPTY = {
  name: "",
  category_id: "",
  brand: "",
  sku: "",
  purchase_price: "",
  mrp: "",
  selling_price: "",
  discount_pct: "",
  qty_on_hand: "",
  min_stock_level: "5",
  supplier: "",
  image_url: "",
  warranty_text: "",
  status: "active",
  product_type: "quantity",
};

function validateForm(form) {
  if (!String(form.name || "").trim()) return "Product name is required.";
  if (!form.category_id) return "Please select a category.";
  return null;
}

export default function InventoryProductForm({ productId = null }) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/categories"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCategories(j.categories || []);
      });
  }, []);

  useEffect(() => {
    if (!productId) {
      setForm(EMPTY);
      setLoadingProduct(false);
      return;
    }
    setLoadingProduct(true);
    fetch(apiUrl(`/api/admin/inventory/products/${productId}`), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          showError(j.message || "Product not found.");
          router.push("/admin/inventory/products");
          return;
        }
        const p = j.product;
        setForm({
          name: p.name || "",
          category_id: String(p.category_id || ""),
          brand: p.brand || "",
          sku: p.sku || "",
          purchase_price: String(p.purchase_price ?? ""),
          mrp: String(p.mrp ?? ""),
          selling_price: String(p.selling_price ?? ""),
          discount_pct: p.discount_pct != null ? String(p.discount_pct) : "",
          qty_on_hand: String(p.qty_on_hand ?? ""),
          min_stock_level: String(p.min_stock_level ?? ""),
          supplier: p.supplier || "",
          image_url: p.image_url || "",
          warranty_text: p.warranty_text || "",
          status: p.status || "active",
          product_type: p.product_type || "quantity",
        });
      })
      .finally(() => setLoadingProduct(false));
  }, [productId, router]);

  function onChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const err = validateForm(form);
    if (err) {
      showError(err);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        category_id: Number(form.category_id),
        purchase_price: Number(form.purchase_price) || 0,
        mrp: Number(form.mrp) || 0,
        selling_price: Number(form.selling_price) || 0,
        discount_pct: form.discount_pct === "" ? null : Number(form.discount_pct),
        min_stock_level: Number(form.min_stock_level) || 0,
      };
      if (!productId) payload.qty_on_hand = Number(form.qty_on_hand) || 0;

      const url =
        productId ?
          apiUrl(`/api/admin/inventory/products/${productId}`)
        : apiUrl("/api/admin/inventory/products");
      const res = await fetch(url, {
        method: productId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save.");
        return;
      }
      showSuccess(productId ? "Product saved." : "Product created.");
      router.push("/admin/inventory/products");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addStock(e) {
    e.preventDefault();
    if (!productId || form.product_type !== "quantity") return;
    const qty = Math.floor(Number(stockQty));
    if (!qty || qty <= 0) {
      showError("Enter quantity to add.");
      return;
    }
    const res = await fetch(apiUrl("/api/admin/inventory/stock"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        movement_type: "purchase",
        qty,
        unit_cost: Number(form.purchase_price) || null,
        note: stockNote || "Stock purchase",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not add stock.");
      return;
    }
    showSuccess(`Stock updated: ${data.qty_on_hand} on hand.`);
    onChange("qty_on_hand", String(data.qty_on_hand));
    setStockQty("");
    setStockNote("");
  }

  if (loadingProduct) {
    return (
      <div className="inventory-app inv-product-form-page">
        <p className="admin-empty">Loading product…</p>
      </div>
    );
  }

  const isSerialized = form.product_type === "serialized";

  return (
    <div className="inventory-app inv-product-form-page inv-pwa-screen">
      <header className="inv-hub-header">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory/products">← Back to products</Link>
          </p>
          <h1>{productId ? "Edit product" : "Add product"}</h1>
          <p>Fill the essentials first. Optional fields are grouped below.</p>
        </div>
      </header>

      <form className="admin-card inv-simple-form" onSubmit={onSubmit} noValidate>
        <div className="inv-simple-form-grid">
          <label className="inv-simple-span2">
            <span>Product name *</span>
            <input value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="e.g. Samsung A15 back cover" />
          </label>

          <label>
            <span>Category *</span>
            <select value={form.category_id} onChange={(e) => onChange("category_id", e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tracking type</span>
            <select value={form.product_type} onChange={(e) => onChange("product_type", e.target.value)}>
              <option value="quantity">Quantity (bulk count)</option>
              <option value="serialized">Serialized (one QR per unit)</option>
            </select>
          </label>

          <label>
            <span>Purchase ₹</span>
            <input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => onChange("purchase_price", e.target.value)} />
          </label>

          <label>
            <span>Selling ₹</span>
            <input type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => onChange("selling_price", e.target.value)} />
          </label>

          <label>
            <span>MRP ₹</span>
            <input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => onChange("mrp", e.target.value)} />
          </label>

          <label>
            <span>Min stock alert</span>
            <input type="number" min="0" value={form.min_stock_level} onChange={(e) => onChange("min_stock_level", e.target.value)} />
          </label>

          {!productId && !isSerialized ?
            <label>
              <span>Opening stock</span>
              <input type="number" min="0" value={form.qty_on_hand} onChange={(e) => onChange("qty_on_hand", e.target.value)} />
            </label>
          : null}

          {productId && !isSerialized ?
            <label>
              <span>Stock on hand</span>
              <input type="number" value={form.qty_on_hand} readOnly disabled />
            </label>
          : null}

          {isSerialized ?
            <div className="inv-simple-hint inv-simple-span2">
              Stock comes from linked QR stickers. After saving, use{" "}
              <Link href="/admin/inventory/stock/add">Add stock (scan)</Link>.
              {productId ?
                <> Current on hand: <strong>{form.qty_on_hand || "0"}</strong>.</>
              : null}
            </div>
          : null}

          <label>
            <span>Status</span>
            <select value={form.status} onChange={(e) => onChange("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <details className="inv-simple-more">
          <summary>More fields (optional)</summary>
          <div className="inv-simple-form-grid">
            <label>
              <span>Brand</span>
              <input value={form.brand} onChange={(e) => onChange("brand", e.target.value)} />
            </label>
            <label>
              <span>SKU / code</span>
              <input value={form.sku} onChange={(e) => onChange("sku", e.target.value)} />
            </label>
            <label>
              <span>Discount %</span>
              <input type="number" min="0" max="100" step="0.1" value={form.discount_pct} onChange={(e) => onChange("discount_pct", e.target.value)} />
            </label>
            <label>
              <span>Supplier</span>
              <input value={form.supplier} onChange={(e) => onChange("supplier", e.target.value)} />
            </label>
            <label className="inv-simple-span2">
              <span>Image URL</span>
              <input value={form.image_url} onChange={(e) => onChange("image_url", e.target.value)} placeholder="https://…" />
            </label>
            <label className="inv-simple-span2">
              <span>Warranty note</span>
              <input value={form.warranty_text} onChange={(e) => onChange("warranty_text", e.target.value)} />
            </label>
          </div>
        </details>

        <div className="inv-simple-actions">
          <Link href="/admin/inventory/products" className="admin-btn admin-btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="admin-btn" disabled={busy}>
            {busy ? "Saving…" : productId ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>

      {productId && !isSerialized ?
        <form className="admin-card inv-simple-form inv-simple-stock" onSubmit={addStock} noValidate>
          <h2 className="inv-simple-subtitle">Add stock (quantity product)</h2>
          <div className="inv-simple-form-grid">
            <label>
              <span>Qty to add</span>
              <input type="number" min="1" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </label>
            <label>
              <span>Note</span>
              <input value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Purchase, return, etc." />
            </label>
          </div>
          <button type="submit" className="admin-btn admin-btn-secondary">
            Add to stock
          </button>
        </form>
      : null}
    </div>
  );
}
