"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { resolveStickerSize } from "@/lib/qr-sticker-sizes";
import ListSkeleton from "@/app/components/ListSkeleton";
import QrCodePreviewModal, { qrScanUrlForCode } from "@/app/components/QrCodePreviewModal";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

const PRESETS = [50, 100, 500, 1000, 5000];
const PAGE_SIZE = 10;
const MOBILE_BATCH = 15;

const SHEET_CARDS = [
  { id: "press12x18", title: "Printing press", detail: "12×18 inch", hint: "Give PDF/PNG to printer" },
  { id: "a4", title: "A4", detail: "Shop printer", hint: "Print and cut" },
  { id: "a3", title: "A3 portrait", detail: "297×420 mm", hint: "Larger shop sheet" },
  { id: "a3landscape", title: "A3 landscape", detail: "420×297 mm", hint: "Wide layout" },
];

const QUICK_EXPORTS = [
  { id: "press12x18", label: "12×18 PDF" },
  { id: "a3", label: "A3 PDF" },
  { id: "a3landscape", label: "A3 landscape PDF" },
  { id: "a4", label: "A4 PDF" },
  { id: "png", label: "PNG / ZIP", format: "png", sheet: "press12x18" },
];

const CODE_PAGE = 50;

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

function codeRangePreview(prefix, count) {
  const p = String(prefix || "GMP").trim().toUpperCase() || "GMP";
  const n = Math.min(5000, Math.max(1, Math.floor(Number(count) || 0)));
  if (!n) return "";
  const pad = (x) => String(x).padStart(6, "0");
  return n === 1 ? `${p}-${pad(1)}` : `${p}-${pad(1)} … ${p}-${pad(n)}`;
}

function GenerateBatchModal({ open, prefix, count, busy, onClose, onPrefix, onCount, onSubmit }) {
  if (!open) return null;
  const preview = codeRangePreview(prefix, count);
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
            <label className="inv-qr-field inv-qr-custom-count">
              <span>Custom quantity (1–5000)</span>
              <input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={count}
                onChange={(e) => {
                  const n = Math.min(5000, Math.max(1, Math.floor(Number(e.target.value) || 0)));
                  if (n) onCount(n);
                }}
              />
            </label>
          </div>
          <label className="inv-qr-field">
            <span>Code prefix</span>
            <input value={prefix} onChange={(e) => onPrefix(e.target.value.toUpperCase())} maxLength={20} placeholder="GMP" />
          </label>
          <p className="inv-qr-modal-note">
            {preview ? `Range: ${preview}` : "Enter quantity."} Print sheet size is chosen when you export.
          </p>
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
            <div className="inv-qr-choice-grid inv-qr-choice-grid--sheets">
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

function BatchExportMenu({ batch, labelSize, onQuickExport, onCustomPrint, open, onToggle }) {
  return (
    <div className="inv-qr-export-wrap">
      <button type="button" className="inv-text-btn" onClick={onToggle} aria-expanded={open}>
        Export ▾
      </button>
      {open ?
        <div className="inv-qr-export-menu" role="menu">
          {QUICK_EXPORTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onQuickExport(batch, item.sheet || item.id, item.format || "pdf", labelSize);
                onToggle();
              }}
            >
              {item.label}
            </button>
          ))}
          <button type="button" role="menuitem" onClick={() => { onCustomPrint(batch); onToggle(); }}>
            More options…
          </button>
        </div>
      : null}
    </div>
  );
}

function BatchCodesModal({ batch, onClose, onViewQr, onDeleteCode, onRefreshBatch }) {
  const [units, setUnits] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPage = useCallback(
    async (nextOffset = 0) => {
      if (!batch?.id) return;
      setLoading(true);
      const qs = new URLSearchParams({
        batch_id: String(batch.id),
        limit: String(CODE_PAGE),
        offset: String(nextOffset),
      });
      const res = await fetch(apiUrl(`/api/admin/inventory/qr/units?${qs}`), { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setUnits(data.units || []);
        setTotal(data.total || 0);
        setOffset(nextOffset);
      }
      setLoading(false);
    },
    [batch?.id]
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  if (!batch) return null;

  const pageNum = Math.floor(offset / CODE_PAGE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / CODE_PAGE));

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inv-qr-codes-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-qr-modal-card inv-qr-codes-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-qr-codes-title">Codes in batch</h3>
            <p>{formatRange(batch)}</p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="inv-qr-codes-body">
          {loading ?
            <ListSkeleton variant="table" rows={6} />
          : (
            <>
              <table className="inv-product-table inv-product-table--clean">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Product</th>
                    <th className="inv-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.code}</strong>
                      </td>
                      <td>{u.status.replace("_", " ")}</td>
                      <td>{u.product_name || "—"}</td>
                      <td className="inv-col-actions inv-qr-code-actions">
                        <button type="button" className="inv-text-btn" onClick={() => onViewQr(u.code)}>
                          View QR
                        </button>
                        {u.status === "unassigned" && !u.is_linked ?
                          <button
                            type="button"
                            className="inv-text-btn is-danger"
                            onClick={async () => {
                              await onDeleteCode(u.code);
                              loadPage(offset);
                              onRefreshBatch();
                            }}
                          >
                            Delete
                          </button>
                        : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer className="inv-table-footer">
                <span>
                  {total ? `${offset + 1}–${Math.min(offset + CODE_PAGE, total)} of ${total}` : "No codes"}
                </span>
                <div className="inv-pagination">
                  <button type="button" disabled={offset <= 0} onClick={() => loadPage(offset - CODE_PAGE)}>
                    Prev
                  </button>
                  <span className="inv-page-num">
                    {pageNum} / {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={offset + CODE_PAGE >= total}
                    onClick={() => loadPage(offset + CODE_PAGE)}
                  >
                    Next
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchCard({ b, onPdf, onViewCodes, onDeleteBatch, onQuickExport, exportOpen, onToggleExport }) {
  const unused = Number(b.unassigned_count || 0);
  const canDelete = unused === Number(b.count) && Number(b.count) > 0;
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
      <div className="inv-product-card-actions inv-qr-batch-actions">
        <button type="button" className="inv-card-action" onClick={() => onViewCodes(b)}>
          View codes
        </button>
        <BatchExportMenu
          batch={b}
          labelSize={b.label_size || "medium"}
          open={exportOpen === b.id}
          onToggle={() => onToggleExport(exportOpen === b.id ? null : b.id)}
          onQuickExport={onQuickExport}
          onCustomPrint={onPdf}
        />
        {canDelete ?
          <button type="button" className="inv-card-action is-danger" onClick={() => onDeleteBatch(b)}>
            Delete batch
          </button>
        : null}
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
  const [codesBatch, setCodesBatch] = useState(null);
  const [previewCode, setPreviewCode] = useState("");
  const [exportMenuId, setExportMenuId] = useState(null);
  const [tableExportMenuId, setTableExportMenuId] = useState(null);
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

  function triggerDownload(batchId, stickerSize, sheetId, format) {
    const q = new URLSearchParams({ size: stickerSize, sheet: sheetId, format });
    window.open(apiUrl(`/api/admin/inventory/qr/batches/${batchId}/print?${q}`), "_blank");
  }

  function downloadExport() {
    if (!printBatch) return;
    triggerDownload(printBatch.id, printSize, printSheet, printFormat);
    setPrintBatch(null);
  }

  function quickExport(batch, sheetId, format, stickerSize) {
    const sz = stickerSize || batch.label_size || "medium";
    triggerDownload(batch.id, sz, sheetId, format);
  }

  async function deleteUnitCode(code) {
    const ok = await confirmAction({
      title: "Delete unused code?",
      text: `${code} will be removed permanently.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/units?code=${encodeURIComponent(code)}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not delete.");
      return;
    }
    showSuccess("Code removed.");
    load();
  }

  async function deleteBatch(b) {
    const canDelete = Number(b.unassigned_count) === Number(b.count);
    if (!canDelete) {
      showError("Only batches where every code is still unused can be deleted.");
      return;
    }
    const ok = await confirmAction({
      title: "Delete entire batch?",
      text: `${formatRange(b)} — ${b.count} unused codes will be removed.`,
      confirmText: "Delete batch",
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/admin/inventory/qr/batches/${b.id}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not delete batch.");
      return;
    }
    showSuccess("Batch deleted.");
    load();
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
          <span>12×18, A3, or A4 sheet</span>
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
                <BatchCard
                  key={b.id}
                  b={b}
                  onPdf={openPrint}
                  onViewCodes={setCodesBatch}
                  onDeleteBatch={deleteBatch}
                  onQuickExport={quickExport}
                  exportOpen={exportMenuId}
                  onToggleExport={setExportMenuId}
                />
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
                      <td className="inv-col-actions inv-qr-table-actions">
                        <button type="button" className="inv-text-btn" onClick={() => setCodesBatch(b)}>
                          Codes
                        </button>
                        <BatchExportMenu
                          batch={b}
                          labelSize={b.label_size || "medium"}
                          open={tableExportMenuId === b.id}
                          onToggle={() => setTableExportMenuId(tableExportMenuId === b.id ? null : b.id)}
                          onQuickExport={quickExport}
                          onCustomPrint={openPrint}
                        />
                        <button type="button" className="inv-text-btn" onClick={() => openPrint(b)}>
                          Customize
                        </button>
                        {Number(b.unassigned_count) === Number(b.count) ?
                          <button type="button" className="inv-text-btn is-danger" onClick={() => deleteBatch(b)}>
                            Delete
                          </button>
                        : null}
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

      <BatchCodesModal
        batch={codesBatch}
        onClose={() => setCodesBatch(null)}
        onViewQr={setPreviewCode}
        onDeleteCode={deleteUnitCode}
        onRefreshBatch={load}
      />

      <QrCodePreviewModal
        code={previewCode}
        scanUrl={previewCode ? qrScanUrlForCode(previewCode) : ""}
        onClose={() => setPreviewCode("")}
      />
    </div>
  );
}
