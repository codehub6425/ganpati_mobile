"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";

export default function QrCodePreviewModal({ code, scanUrl, onClose }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    if (!scanUrl) {
      setDataUrl("");
      return;
    }
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(scanUrl, { margin: 1, width: 280, errorCorrectionLevel: "M" })
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [scanUrl]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setCopyOk(false);
    }
  }

  if (!code) return null;

  return (
    <div className="admin-modal inv-qr-preview-modal" role="dialog" aria-modal="true" aria-label="QR code preview">
      <button type="button" className="admin-modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="admin-modal-card inv-qr-preview-card">
        <div className="admin-modal-head">
          <h3>{code}</h3>
          <button type="button" className="ledger-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="inv-qr-preview-body">
          {dataUrl ?
            <img src={dataUrl} alt="" className="inv-qr-preview-img" />
          : <p className="admin-muted">Loading QR…</p>}
          <div className="inv-qr-preview-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={copyCode}>
              {copyOk ? "Copied" : "Copy code"}
            </button>
            <Link
              href={`/admin/inventory/scan?code=${encodeURIComponent(code)}`}
              className="admin-btn"
              onClick={onClose}
            >
              Open scan page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build scan URL on client using current origin. */
export function qrScanUrlForCode(code) {
  const formatted = String(code || "").trim().toUpperCase();
  if (!formatted) return "";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const path = apiUrl(`/admin/inventory/scan?code=${encodeURIComponent(formatted)}`);
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
