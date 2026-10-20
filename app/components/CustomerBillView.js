"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import SaleBillSheet from "./SaleBillSheet";
import "../bill.css";

export default function CustomerBillView({ token }) {
  const [bill, setBill] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/bills/${encodeURIComponent(token)}`));
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.bill?.lines?.length) {
          setStatus("missing");
          return;
        }
        setBill(data.bill);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function downloadBill() {
    if (!bill) return;
    import("./exportSaleBillPdf").then(({ downloadSaleBillPdf }) => {
      downloadSaleBillPdf(bill);
    });
  }

  if (status === "loading") {
    return (
      <main className="customer-bill-page">
        <p className="customer-bill-status">Loading your bill…</p>
      </main>
    );
  }

  if (status === "missing") {
    return (
      <main className="customer-bill-page">
        <div className="customer-bill-card">
          <h1>Bill not found</h1>
          <p>This link is invalid or the bill is no longer available. Please contact the shop.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-bill-page">
      <div className="customer-bill-card">
        <p className="customer-bill-kicker">Ganpati Mobile Point</p>
        <h1>{bill.kind === "repair" ? "Your repair bill" : "Your bill"}</h1>
        <p className="customer-bill-lead">
          Open the bill below, or download a PDF to keep it on your phone.
        </p>
        <SaleBillSheet bill={bill} />
        <div className="customer-bill-actions">
          <button type="button" className="customer-bill-download" onClick={downloadBill}>
            Download bill
          </button>
        </div>
      </div>
    </main>
  );
}
