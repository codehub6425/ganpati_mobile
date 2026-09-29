"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { showError, showSuccess } from "@/lib/swal";

const PRESETS = [500, 1000, 5000];
const PAGE_SIZE = 10;
const MOBILE_BATCH = 15;

function formatRange(b) {
  const pad = (n) => String(n).padStart(6, "0");
  return `${b.prefix}-${pad(b.start_num)} … ${b.prefix}-${pad(b.end_num)}`;
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function GenerateBatchModal({ open, prefix, count, busy, onClose, onPrefix, onCount, onSubmit }) {
  if (!open) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inv-qr-gen-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-cat-modal-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-qr-gen-title">Generate QR batch</h3>
            <p>Create sticker codes and download a print PDF.</p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="inv-cat-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="inv-cat-modal-label">
            <span>Prefix</span>
            <input value={prefix} onChange={(e) => onPrefix(e.target.value.toUpperCase())} maxLength={20} placeholder="GMP" />
          </label>
          <label className="inv-cat-modal-label">
            <span>Batch size</span>
            <select value={count} onChange={(e) => onCount(Number(e.target.value))}>
              {PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n} codes
                </option>
              ))}
            </select>
          </label>
          <div className="inv-cat-modal-actions">
            <span />
            <div className="inv-cat-modal-actions-main">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchCard({ b, onPdf }) {
  return (
    <li className="inv-product-card inv-qr-batch-card">
      <div className="inv-product-card-main inv-qr-batch-main">
        <span className="inv-product-card-thumb inv-qr-batch-icon" aria-hidden="true">
          ▦
        </span>
        <div className="inv-product-card-body">
          <strong>{formatRange(b)}</strong>
          <span className="inv-product-card-meta">
            {b.count} codes · {formatDate(b.created_at)}
          </span>
          <span className="inv-product-card-price inv-qr-batch-stats">
            <span>Unassigned {b.unassigned_count}</span>
            <span>In stock {b.in_stock_count}</span>
            <span>Sold {b.sold_count}</span>
          </span>
        </div>
      </div>
      <div className="inv-product-card-actions">
        <button type="button" className="inv-card-action" onClick={() => onPdf(b.id)}>
          Download PDF
        </button>
        <Link href="/admin/inventory/stock/add" className="inv-card-action">
          Link stock
        </Link>
      </div>
    </li>
  );
}

export default function InventoryQrManagementApp() {
  const [batches, setBatches] = useState([]);
  const [prefix, setPrefix] = useState("GMP");
  const [count, setCount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [qrKpis, setQrKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_BATCH);
  const loadMoreRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(apiUrl("/api/admin/inventory/qr/batches"), { credentials: "include" }).then((r) => r.json()),
      fetch(apiUrl("/api/admin/inventory/dashboard"), { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([batchJson, dashJson]) => {
        if (batchJson.ok) {
          setBatches(batchJson.batches || []);
          setPage(1);
          setMobileVisibleCount(MOBILE_BATCH);
        }
        if (dashJson.ok) setQrKpis(dashJson.kpis);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return batches.slice(start, start + PAGE_SIZE);
  }, [batches, page]);

  const mobileItems = useMemo(() => batches.slice(0, mobileVisibleCount), [batches, mobileVisibleCount]);
  const hasMoreMobile = mobileVisibleCount < batches.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreMobile) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMobileVisibleCount((c) => Math.min(c + MOBILE_BATCH, batches.length));
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreMobile, batches.length]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/admin/inventory/qr/batches"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not generate.");
        return;
      }
      showSuccess(`Created ${data.batch.count} codes (${data.batch.prefix}-${String(data.batch.startNum).padStart(6, "0")} …).`);
      setGenModalOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf(batchId) {
    window.open(apiUrl(`/api/admin/inventory/qr/batches/${batchId}/print`), "_blank");
  }

  const showingFrom = batches.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, batches.length);

  return (
    <div className="inventory-app inv-products-list-page inv-pwa-screen inv-qr-page">
      <header className="inv-pwa-page-head">
        <Link href="/admin/inventory" className="inv-pwa-back" aria-label="Back to inventory">
          ←
        </Link>
        <div className="inv-pwa-head-text">
          <h1>QR management</h1>
          <p className="inv-pwa-head-sub">{batches.length} batches</p>
        </div>
      </header>

      {qrKpis ?
        <div className="inv-qr-kpi-chips inv-mobile-only">
          <span className="inv-qr-chip">Unassigned <strong>{qrKpis.qr_unassigned ?? 0}</strong></span>
          <span className="inv-qr-chip">In stock <strong>{qrKpis.qr_in_stock ?? 0}</strong></span>
          <span className="inv-qr-chip">Sold <strong>{qrKpis.qr_sold ?? 0}</strong></span>
        </div>
      : null}

      <nav className="inv-qr-workflow inv-mobile-only" aria-label="QR workflow">
        <Link href="/admin/inventory/stock/add">1. Link stock</Link>
        <Link href="/admin/inventory/stock">2. Stock list</Link>
        <Link href="/admin/inventory/scan">3. Scan / sell</Link>
      </nav>

      <header className="inv-hub-header inv-desktop-only">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory">← Inventory dashboard</Link>
          </p>
          <h1>QR management</h1>
          <p>Generate sticker codes, print PDF, then link codes when adding stock.</p>
        </div>
        <div className="inv-qr-head-actions">
          <Link href="/admin/inventory/stock/add" className="admin-btn admin-btn-secondary">
            Add stock
          </Link>
          <button type="button" className="admin-btn" onClick={() => setGenModalOpen(true)}>
            Generate batch
          </button>
        </div>
      </header>

      {qrKpis ?
        <div className="inv-stat-grid inv-qr-kpi-row inv-desktop-only">
          <article className="inv-stat-card inv-stat-sky">
            <div className="inv-stat-icon" aria-hidden="true">
              ▦
            </div>
            <div>
              <span>Unassigned</span>
              <strong>{qrKpis.qr_unassigned ?? 0}</strong>
              <small>Stickers not linked</small>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-green">
            <div className="inv-stat-icon" aria-hidden="true">
              ✓
            </div>
            <div>
              <span>In stock</span>
              <strong>{qrKpis.qr_in_stock ?? 0}</strong>
              <small>Linked to products</small>
            </div>
          </article>
          <article className="inv-stat-card inv-stat-red">
            <div className="inv-stat-icon" aria-hidden="true">
              ◉
            </div>
            <div>
              <span>Sold</span>
              <strong>{qrKpis.qr_sold ?? 0}</strong>
              <small>Already sold</small>
            </div>
          </article>
        </div>
      : null}

      <form className="admin-card inv-qr-gen-form inv-desktop-only" onSubmit={(e) => { e.preventDefault(); generate(); }}>
        <h2 className="inv-qr-gen-title">New batch</h2>
        <div className="inv-qr-gen-fields">
          <label>
            <span>Prefix</span>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} maxLength={20} />
          </label>
          <label>
            <span>Batch size</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {PRESETS.map((n) => (
                <option key={n} value={n}>
                  {n} codes
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="admin-btn" disabled={busy}>
            {busy ? "Generating…" : "Generate batch"}
          </button>
        </div>
      </form>

      <section className="admin-card inv-table-section inv-table-card">
        <header className="inv-bottom-head inv-qr-batch-head">
          <h2>Recent batches</h2>
          <Link href="/admin/inventory/stock" className="inv-desktop-only">
            View all QR stock
          </Link>
        </header>

        {loading ?
          <p className="admin-empty inv-pwa-loading">Loading batches…</p>
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="QR batches">
              {mobileItems.map((b) => (
                <BatchCard key={b.id} b={b} onPdf={downloadPdf} />
              ))}
            </ul>

            {hasMoreMobile && !loading ?
              <div ref={loadMoreRef} className="inv-infinite-sentinel inv-mobile-only" aria-hidden="true">
                <span className="inv-infinite-spinner" />
                <span>Loading more…</span>
              </div>
            : null}

            {batches.length > 0 && !hasMoreMobile && !loading ?
              <p className="inv-infinite-done inv-mobile-only">All batches loaded</p>
            : null}

            {!batches.length ?
              <p className="admin-empty">No batches yet. Generate your first sticker batch.</p>
            : null}

            <div className="inv-table-wrap inv-desktop-only">
              <table className="inv-product-table inv-product-table--clean">
                <thead>
                  <tr>
                    <th scope="col">Code range</th>
                    <th scope="col">Count</th>
                    <th scope="col">Unassigned</th>
                    <th scope="col">In stock</th>
                    <th scope="col">Sold</th>
                    <th scope="col">Created</th>
                    <th scope="col" className="inv-col-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{formatRange(b)}</strong>
                      </td>
                      <td>{b.count}</td>
                      <td>{b.unassigned_count}</td>
                      <td>{b.in_stock_count}</td>
                      <td>{b.sold_count}</td>
                      <td>{formatDate(b.created_at) || "—"}</td>
                      <td className="inv-col-actions">
                        <button type="button" className="inv-text-btn" onClick={() => downloadPdf(b.id)}>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {batches.length > 0 ?
              <footer className="inv-table-footer inv-desktop-only">
                <span>
                  {showingFrom}–{showingTo} of {batches.length}
                </span>
                <div className="inv-pagination">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </button>
                  <span className="inv-page-num">
                    {page} / {pageCount}
                  </span>
                  <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </footer>
            : null}
          </>
        )}
      </section>

      <button
        type="button"
        className="inv-pwa-fab admin-btn inv-mobile-only"
        aria-label="Generate QR batch"
        onClick={() => setGenModalOpen(true)}
      >
        +
      </button>

      <GenerateBatchModal
        open={genModalOpen}
        prefix={prefix}
        count={count}
        busy={busy}
        onClose={() => !busy && setGenModalOpen(false)}
        onPrefix={setPrefix}
        onCount={setCount}
        onSubmit={generate}
      />
    </div>
  );
}
