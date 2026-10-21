"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { resolveStickerSize } from "@/lib/qr-sticker-sizes";
import ListSkeleton from "@/app/components/ListSkeleton";
import { showError, showSuccess } from "@/lib/swal";

const PRESETS = [50, 100, 500, 1000, 5000];
const PAGE_SIZE = 10;
const MOBILE_BATCH = 15;

const SHEET_CARDS = [
  { id: "press12x18", title: "Printing press", detail: "12×18 inch", hint: "Give the file to the printer" },
  { id: "a4", title: "Shop printer", detail: "A4 paper", hint: "Print here and cut" },
];

const SIZE_CARDS = [
  { id: "small", title: "Small", detail: "20 mm", hint: "Cables, earbuds" },
  { id: "medium", title: "Medium", detail: "30 mm", hint: "Chargers, covers" },
  { id: "large", title: "Large", detail: "40 mm", hint: "Boxes, phones" },
];

function formatRange(b) {
  const pad = (n) => String(n).padStart(6, "0");
  const start = b.start_num ?? b.startNum;
  const end = b.end_num ?? b.endNum;
  return `${b.prefix}-${pad(start)} … ${b.prefix}-${pad(end)}`;
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function sheetCount(count, size, sheet) {
  const layout = resolveStickerSize(size, sheet);
  return Math.max(1, Math.ceil(Number(count || 0) / layout.perPage));
}

function ChoiceCard({ selected, title, detail, hint, onClick }) {
  return (
    <button
      type="button"
      className={`inv-qr-choice${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
      {hint ? <small>{hint}</small> : null}
    </button>
  );
}

function GenerateBatchModal({ open, prefix, count, busy, onClose, onPrefix, onCount, onSubmit }) {
  if (!open) return null;
  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inv-qr-gen-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-qr-modal-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-qr-gen-title">Make new stickers</h3>
            <p>Create unused QR codes. You pick size when you print.</p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="inv-qr-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="inv-qr-field">
            <span>How many codes?</span>
            <div className="inv-qr-chip-row">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`inv-qr-count-chip${count === n ? " is-selected" : ""}`}
                  onClick={() => onCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="inv-qr-field">
            <span>Code prefix</span>
            <input value={prefix} onChange={(e) => onPrefix(e.target.value.toUpperCase())} maxLength={20} placeholder="GMP" />
          </label>
          <p className="inv-qr-modal-note">Example: {prefix || "GMP"}-000001. Print size is chosen on download.</p>
          <div className="inv-qr-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn" disabled={busy}>
              {busy ? "Creating…" : `Create ${count} codes`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrintSizeModal({ batch, size, sheet, format, onSize, onSheet, onFormat, onClose, onConfirm }) {
  if (!batch) return null;
  const layout = resolveStickerSize(size, sheet);
  const sheets = sheetCount(batch.count, size, sheet);
  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inv-qr-print-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-qr-modal-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-qr-print-title">Print stickers</h3>
            <p>{formatRange(batch)}</p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="inv-qr-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
        >
          <div className="inv-qr-field">
            <span>1. Where will you print?</span>
            <div className="inv-qr-choice-grid inv-qr-choice-grid--2">
              {SHEET_CARDS.map((card) => (
                <ChoiceCard
                  key={card.id}
                  selected={sheet === card.id}
                  title={card.title}
                  detail={card.detail}
                  hint={card.hint}
                  onClick={() => onSheet(card.id)}
                />
              ))}
            </div>
          </div>

          <div className="inv-qr-field">
            <span>2. Sticker size</span>
            <div className="inv-qr-choice-grid inv-qr-choice-grid--3">
              {SIZE_CARDS.map((card) => {
                const option = resolveStickerSize(card.id, sheet);
                return (
                  <ChoiceCard
                    key={card.id}
                    selected={size === card.id}
                    title={card.title}
                    detail={`${card.detail} · ${option.perPage}/sheet`}
                    hint={card.hint}
                    onClick={() => onSize(card.id)}
                  />
                );
              })}
            </div>
          </div>

          <div className="inv-qr-field">
            <span>3. File type</span>
            <div className="inv-qr-choice-grid inv-qr-choice-grid--2">
              <ChoiceCard
                selected={format === "pdf"}
                title="PDF"
                detail="Best for the press"
                hint="Codes printed under each QR"
                onClick={() => onFormat("pdf")}
              />
              <ChoiceCard
                selected={format === "png"}
                title="Image"
                detail="PNG sheet"
                hint="Photo file, or ZIP if many sheets"
                onClick={() => onFormat("png")}
              />
            </div>
          </div>

          <p className="inv-qr-print-summary">
            {batch.count} codes · {layout.qrMm} mm · {sheets} {sheets === 1 ? "sheet" : "sheets"}
          </p>

          <div className="inv-qr-modal-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn">
              {format === "png" ? "Download image" : "Download PDF"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BatchCard({ b, onPdf }) {
  const unused = Number(b.unassigned_count || 0);
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
            <span>{unused} unused</span>
            <span>{b.in_stock_count} in shop</span>
            <span>{b.sold_count} sold</span>
          </span>
        </div>
      </div>
      <div className="inv-product-card-actions">
        <button type="button" className="inv-card-action inv-card-action-primary" onClick={() => onPdf(b)}>
          Print stickers
        </button>
        <Link href="/admin/inventory/stock/add" className="inv-card-action">
          Link to product
        </Link>
      </div>
    </li>
  );
}

export default function InventoryQrManagementApp() {
  const [batches, setBatches] = useState([]);
  const [prefix, setPrefix] = useState("GMP");
  const [count, setCount] = useState(100);
  const [size, setSize] = useState("medium");
  const [sheet, setSheet] = useState("press12x18");
  const [busy, setBusy] = useState(false);
  const [qrKpis, setQrKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [printBatch, setPrintBatch] = useState(null);
  const [printSize, setPrintSize] = useState("medium");
  const [printSheet, setPrintSheet] = useState("press12x18");
  const [printFormat, setPrintFormat] = useState("pdf");
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
        body: JSON.stringify({ prefix, count, label_size: size }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not generate.");
        return;
      }
      const created = data.batch || {};
      showSuccess(`Created ${created.count} codes. Download the print file next.`);
      setGenModalOpen(false);
      load();
      openPrint({
        id: created.batchId,
        prefix: created.prefix,
        start_num: created.startNum,
        end_num: created.endNum,
        count: created.count,
        label_size: created.label_size || size,
      });
    } finally {
      setBusy(false);
    }
  }

  function openPrint(batch) {
    setPrintSize(resolveStickerSize(batch.label_size || size, sheet).id);
    setPrintSheet(sheet);
    setPrintFormat("pdf");
    setPrintBatch(batch);
  }

  function downloadExport() {
    if (!printBatch) return;
    const q = new URLSearchParams({ size: printSize, sheet: printSheet, format: printFormat });
    window.open(apiUrl(`/api/admin/inventory/qr/batches/${printBatch.id}/print?${q}`), "_blank");
    setPrintBatch(null);
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
          <h1>QR stickers</h1>
          <p className="inv-pwa-head-sub">Print, stick, then scan to sell</p>
        </div>
      </header>

      <header className="inv-hub-header inv-desktop-only">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory">← Inventory dashboard</Link>
          </p>
          <h1>QR stickers</h1>
          <p>Make codes, print a sticker sheet, stick on the product, then scan to sell.</p>
        </div>
        <div className="inv-qr-head-actions">
          <Link href="/admin/inventory/stock" className="admin-btn admin-btn-secondary">
            QR code list
          </Link>
          <Link href="/admin/inventory/stock/add" className="admin-btn admin-btn-secondary">
            Link to product
          </Link>
          <button type="button" className="admin-btn" onClick={() => setGenModalOpen(true)}>
            Make stickers
          </button>
        </div>
      </header>

      <ol className="inv-qr-steps">
        <li>
          <strong>1. Make</strong>
          <span>Create unused codes</span>
        </li>
        <li>
          <strong>2. Print</strong>
          <span>Press sheet or A4</span>
        </li>
        <li>
          <strong>3. Scan</strong>
          <span>Sell from the sticker</span>
        </li>
      </ol>

      {qrKpis ?
        <div className="inv-qr-kpi-chips">
          <span className="inv-qr-chip">Unused <strong>{qrKpis.qr_unassigned ?? 0}</strong></span>
          <span className="inv-qr-chip">In shop <strong>{qrKpis.qr_in_stock ?? 0}</strong></span>
          <span className="inv-qr-chip">Sold <strong>{qrKpis.qr_sold ?? 0}</strong></span>
        </div>
      : null}

      <nav className="inv-qr-workflow inv-mobile-only" aria-label="Next steps">
        <Link href="/admin/inventory/stock">Code list</Link>
        <Link href="/admin/inventory/stock/add">Link to product</Link>
        <Link href="/admin/inventory/scan">Scan / sell</Link>
      </nav>

      <section className="admin-card inv-table-section inv-table-card">
        <header className="inv-bottom-head inv-qr-batch-head">
          <h2>Your batches</h2>
          <button type="button" className="inv-text-btn inv-desktop-only" onClick={() => setGenModalOpen(true)}>
            Make more
          </button>
        </header>

        {loading ?
          <ListSkeleton variant="catalog" rows={6} />
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="QR batches">
              {mobileItems.map((b) => (
                <BatchCard key={b.id} b={b} onPdf={openPrint} />
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
              <div className="inv-qr-empty">
                <p>No sticker codes yet.</p>
                <button type="button" className="admin-btn" onClick={() => setGenModalOpen(true)}>
                  Make your first batch
                </button>
              </div>
            : null}

            <div className="inv-table-wrap inv-desktop-only">
              <table className="inv-product-table inv-product-table--clean">
                <thead>
                  <tr>
                    <th scope="col">Codes</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unused</th>
                    <th scope="col">In shop</th>
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
                        <button type="button" className="inv-text-btn" onClick={() => openPrint(b)}>
                          Print
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
        aria-label="Make new stickers"
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

      <PrintSizeModal
        batch={printBatch}
        size={printSize}
        sheet={printSheet}
        format={printFormat}
        onSize={setPrintSize}
        onSheet={setPrintSheet}
        onFormat={setPrintFormat}
        onClose={() => setPrintBatch(null)}
        onConfirm={downloadExport}
      />
    </div>
  );
}
