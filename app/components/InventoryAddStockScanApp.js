"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import InvPageShell from "@/app/components/InvPageShell";
import QrCodeScanner from "@/app/components/QrCodeScanner";
import { apiUrl } from "@/lib/basePath";
import { normalizeQrCode } from "@/lib/qr-code";
import { showError, showSuccess } from "@/lib/swal";
import { WARRANTY_MONTH_CHOICES } from "@/lib/warranty";

export default function InventoryAddStockScanApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = normalizeQrCode(searchParams.get("code") || "");
  const [code, setCode] = useState(initialCode);
  const [lookup, setLookup] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_id: "",
    purchase_price: "",
    selling_price: "",
    supplier: "",
    note: "",
    has_serial: false,
    serial_number: "",
    has_made_in: false,
    made_in_date: "",
    has_warranty: false,
    warranty_months: "12",
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
    const c = normalizeQrCode(raw);
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

  useEffect(() => {
    if (initialCode) runLookup(initialCode);
  }, [initialCode, runLookup]);

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
          supplier: form.supplier,
          note: form.note,
          serial_number: form.has_serial ? form.serial_number : undefined,
          made_in_date: form.has_made_in ? form.made_in_date : undefined,
          warranty_months: form.has_warranty ? form.warranty_months : undefined,
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
      subtitle="Scan a printed sticker and link it to a serialized product. Serial, made-in date, and warranty are optional."
    >
      <section className="admin-card inv-scan-panel">
        <div className="inv-scan-code-row">
          <input
            placeholder="Scan or type code e.g. GMP-000125"
            value={code}
            onChange={(e) => setCode(normalizeQrCode(e.target.value))}
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
              <span>Supplier</span>
              <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </label>

            <div className="ledger-accessory-options" role="group" aria-label="Optional unit details">
              <label className="ledger-accessory-warranty-check">
                <input
                  type="checkbox"
                  checked={form.has_serial}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      has_serial: e.target.checked,
                      serial_number: e.target.checked ? form.serial_number : "",
                    })
                  }
                />
                <span>Serial no.</span>
              </label>
              <label className="ledger-accessory-warranty-check">
                <input
                  type="checkbox"
                  checked={form.has_made_in}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      has_made_in: e.target.checked,
                      made_in_date: e.target.checked ? form.made_in_date : "",
                    })
                  }
                />
                <span>Made-in date</span>
              </label>
              <label className="ledger-accessory-warranty-check">
                <input
                  type="checkbox"
                  checked={form.has_warranty}
                  onChange={(e) => setForm({ ...form, has_warranty: e.target.checked })}
                />
                <span>Warranty</span>
              </label>
            </div>

            {form.has_serial ?
              <label>
                <span>Serial number</span>
                <input
                  maxLength={80}
                  placeholder="Enter serial number"
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                />
              </label>
            : null}
            {form.has_made_in ?
              <label>
                <span>Made-in date</span>
                <input
                  type="date"
                  value={form.made_in_date}
                  onChange={(e) => setForm({ ...form, made_in_date: e.target.value })}
                />
              </label>
            : null}
            {form.has_warranty ?
              <label>
                <span>Warranty</span>
                <select
                  value={form.warranty_months}
                  onChange={(e) => setForm({ ...form, warranty_months: e.target.value })}
                >
                  {WARRANTY_MONTH_CHOICES.map((m) => (
                    <option key={m} value={String(m)}>
                      {m} months
                    </option>
                  ))}
                </select>
              </label>
            : null}

            <button type="submit" className="admin-btn" disabled={busy}>
              {busy ? "Saving…" : "Add to stock"}
            </button>
          </form>
        : null}
      </section>
    </InvPageShell>
  );
}
