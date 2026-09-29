"use client";

import { useEffect, useRef, useState } from "react";

export default function QrCodeScanner({ onScan, active = true }) {
  const regionId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId.current);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            const text = String(decoded || "").trim();
            if (text && onScan) onScan(text);
          },
          () => {}
        );
      } catch (e) {
        setError("Camera not available. Type the code manually.");
      }
    }

    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {});
        s.clear().catch(() => {});
      }
    };
  }, [active, onScan]);

  return (
    <div className="inv-qr-scanner">
      <div id={regionId.current} className="inv-qr-scanner-view" />
      {error ? <p className="inv-qr-scanner-hint">{error}</p> : null}
    </div>
  );
}
