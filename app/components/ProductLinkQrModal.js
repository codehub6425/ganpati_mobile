"use client";

import { useCallback, useEffect, useState } from "react";
import QrCodeScanner from "@/app/components/QrCodeScanner";
import { apiUrl } from "@/lib/basePath";
import { normalizeQrCode } from "@/lib/qr-code";
import { showError, showSuccess } from "@/lib/swal";

export default function ProductLinkQrModal({ product, open, onClose, onLinked }) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const reset = useCallback(() => {
    setCode("");
    setLookup(null);
    setUseCamera(false);
    setNote("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const runLookup = useCallback(async (raw) => {
    const c = normalizeQrCode(raw);
    if (!c) return;
    setCode(c);
    setLookup(null);
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/lookup?code=${encodeURIComponent(c)}`), {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "QR not found.");
      return;
    }
    setLookup(data);
  }, []);

  function onScan(text) {
    runLookup(text);
    setUseCamera(false);
  }

  async function linkQr(e) {
    e.preventDefault();
    if (!product?.id) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/qr/link"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          product_id: product.id,
          purchase_price: product.purchase_price,
          selling_price: product.selling_price,
          supplier: product.supplier,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not link QR.");
        return;
      }
      showSuccess(`Linked ${code} to ${product.name}.`);
      onLinked?.(data);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  if (!open || !product) return null;

  const isSerialized = product.product_type === "serialized";
  const canLink = lookup?.actions?.can_link && isSerialized;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-link-qr-title">
      <button type="button" className="admin-modal-backdrop" onClick={() => !busy && onClose()} aria-label="Close" />
      <div className="admin-modal-card inv-product-link-qr-modal">
        <header className="admin-modal-head">
          <div>
            <h3 id="product-link-qr-title">Link QR sticker</h3>
            <p>
              Product: <strong>{product.name}</strong>
            </p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={() => !busy && onClose()} aria-label="Close">
            ×
          </button>
        </header>

        {!isSerialized ?
          <p className="inv-product-link-qr-warn" role="alert">
            This product is <strong>quantity</strong> type. Edit the product and set type to <strong>Serialized (QR)</strong>{" "}
            before linking stickers.
          </p>
        : (
          <>
            <div className="inv-scan-code-row">
              <input
                placeholder="Scan or type code e.g. GMP-000125"
                value={code}
                onChange={(e) => setCode(normalizeQrCode(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && runLookup(code)}
                disabled={busy}
              />
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => runLookup(code)} disabled={busy}>
                Lookup
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setUseCamera((v) => !v)}
                disabled={busy}
              >
                {useCamera ? "Hide camera" : "Scan QR"}
              </button>
            </div>

            {useCamera ?
              <QrCodeScanner onScan={onScan} active={useCamera} />
            : null}

            {lookup && !canLink ?
              <p className="inv-product-link-qr-status" role="status">
                This code is <strong>{lookup.unit.status.replace("_", " ")}</strong>
                {lookup.product ?
                  <>
                    {" "}
                    and already linked to <strong>{lookup.product.name}</strong>.
                  </>
                : lookup.unit.status !== "unassigned" ?
                  " — linked codes cannot be removed."
                : null}
              </p>
            : null}

            {canLink ?
              <form className="inv-link-form inv-product-link-qr-form" onSubmit={linkQr}>
                <p className="inv-product-link-qr-ready">
                  <strong>{code}</strong> is unused and ready to link.
                </p>
                <label>
                  <span>Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} disabled={busy} />
                </label>
                <div className="inv-qr-modal-actions">
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={() => onClose()} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-btn" disabled={busy}>
                    {busy ? "Linking…" : "Link to product"}
                  </button>
                </div>
              </form>
            : null}
          </>
        )}
      </div>
    </div>
  );
}
