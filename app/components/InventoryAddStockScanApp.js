"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import QrCodeScanner from "@/app/components/QrCodeScanner";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

export default function InventoryAddStockScanApp() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_id: "",
    purchase_price: "",
    selling_price: "",
    warranty_months: "",
    supplier: "",
    note: "",
  });
  const [useCamera, setUseCamera] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/products?status=active"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setProducts((j.products || []).filter((p) => p.product_type === "serialized"));
        }
      });
  }, []);

  const runLookup = useCallback(async (raw) => {
    const c = String(raw || "").trim();
    if (!c) return;
    setCode(c);
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/lookup?code=${encodeURIComponent(c)}`), {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Not found.");
      setLookup(null);
      return;
    }
    setLookup(data);
    if (data.product) {
      setForm((f) => ({
        ...f,
        product_id: String(data.product.id),
        purchase_price: String(data.product.purchase_price ?? ""),
        selling_price: String(data.product.selling_price ?? ""),
      }));
    }
  }, []);

  function onScan(text) {
    runLookup(text);
    setUseCamera(false);
  }

  async function linkStock(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/qr/link"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          product_id: Number(form.product_id),
          purchase_price: form.purchase_price,
          selling_price: form.selling_price,
          warranty_months: form.warranty_months,
          supplier: form.supplier,
          note: form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not link.");
        return;
      }
      showSuccess("Stock linked to QR.");
      router.push(`/admin/inventory/scan?code=${encodeURIComponent(code)}`);
    } finally {
      setBusy(false);
    }
  }

  const canLink = lookup?.actions?.can_link;

  return (
    <InvPageShell
      title="Add stock (scan QR)"
      subtitle="Step 2: Scan a pre-printed sticker and link it to a serialized product."
    >
      <section className="admin-card inv-scan-panel">
        <div className="inv-scan-code-row">
          <input
            placeholder="Scan or type code e.g. GMP-000125"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && runLookup(code)}
          />
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => runLookup(code)}>
            Lookup
          </button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setUseCamera((v) => !v)}>
            {useCamera ? "Hide camera" : "Use camera"}
          </button>
        </div>
        {useCamera ?
          <QrCodeScanner onScan={onScan} active={useCamera} />
        : null}

        {lookup && !canLink ?
          <div className="inv-scan-summary">
            <p>
              Status: <strong>{lookup.unit.status}</strong>
              {lookup.product ?
                <>
                  {" "}
                  · <Link href={`/admin/inventory/scan?code=${encodeURIComponent(code)}`}>{lookup.product.name}</Link>
                </>
              : null}
            </p>
          </div>
        : null}

        {canLink ?
          <form className="inv-link-form" onSubmit={linkStock}>
            <label>
              <span>Product *</span>
              <select
                required
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              >
                <option value="">Select serialized product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Purchase price ₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              />
            </label>
            <label>
              <span>Selling price ₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
            </label>
            <label>
              <span>Warranty (months)</span>
              <input
                type="number"
                min="0"
                value={form.warranty_months}
                onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
              />
            </label>
            <label>
              <span>Supplier</span>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </label>
            <button type="submit" className="admin-btn" disabled={busy}>
              {busy ? "Saving…" : "Add to stock"}
            </button>
          </form>
        : null}
      </section>
    </InvPageShell>
  );
}
