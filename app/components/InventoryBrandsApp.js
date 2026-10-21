"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import BrandImageUpload from "@/app/components/BrandImageUpload";
import { apiUrl, productImageSrc } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

function BrandModal({ open, mode, brand, busy, isAdmin, onClose, onSubmit, onDelete }) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("99");
  const [status, setStatus] = useState("active");
  const [stagingToken] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ?
      crypto.randomUUID()
    : `bst-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [imageStorageKey, setImageStorageKey] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [clearBrandImage, setClearBrandImage] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && brand) {
      setName(brand.name || "");
      setSortOrder(String(brand.sort_order ?? 99));
      setStatus(brand.status || "active");
      setImageStorageKey(brand.image_storage_key || null);
      setImagePreviewUrl(brand.image_url || "");
      setClearBrandImage(false);
    } else {
      setName("");
      setSortOrder("99");
      setStatus("active");
      setImageStorageKey(null);
      setImagePreviewUrl("");
      setClearBrandImage(false);
    }
  }, [open, mode, brand]);

  function onImageChange({ storage_key, url, cleared }) {
    if (cleared) {
      setImageStorageKey(null);
      setImagePreviewUrl("");
      setClearBrandImage(true);
      return;
    }
    setImageStorageKey(storage_key || null);
    setImagePreviewUrl(url || "");
    setClearBrandImage(false);
  }

  if (!open) return null;

  return (
    <div className="admin-modal inv-brand-modal" role="dialog" aria-modal="true" aria-labelledby="inv-brand-modal-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-brand-modal-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-brand-modal-title">{mode === "edit" ? "Edit brand" : "Add brand"}</h3>
            <p className="inv-brand-modal-sub">
              One brand (e.g. JBL) can cover many products — headphones, speakers, neckbands, etc.
            </p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="inv-brand-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              name: name.trim(),
              sort_order: Number(sortOrder) || 99,
              status,
            };
            if (clearBrandImage) payload.clear_brand_image = true;
            else if (!brand?.id && imageStorageKey) payload.staging_token = stagingToken;
            onSubmit(payload);
          }}
        >
          <div className="inv-brand-modal-grid">
            <div className="inv-brand-modal-logo">
              <BrandImageUpload
                brandId={brand?.id || null}
                stagingToken={stagingToken}
                storageKey={imageStorageKey}
                previewUrl={imagePreviewUrl}
                disabled={busy}
                onChange={onImageChange}
              />
            </div>
            <div className="inv-brand-modal-fields">
              <label className="inv-cat-modal-label">
                <span>Brand name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. JBL" autoFocus />
              </label>
              <label className="inv-cat-modal-label">
                <span>Sort order</span>
                <input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                <span className="inv-field-hint">Lower numbers appear first in lists.</span>
              </label>
              <label className="inv-cat-modal-label">
                <span>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
          {mode === "edit" && brand ?
            <p className="inv-cat-modal-meta">
              Slug: <code>{brand.slug}</code>
              {Number(brand.product_count) > 0 ?
                <> · {brand.product_count} product(s)</>
              : null}
            </p>
          : null}
          <div className="inv-cat-modal-actions">
            {mode === "edit" && onDelete && isAdmin ?
              <button type="button" className="admin-btn admin-btn-secondary is-danger-text" onClick={onDelete}>
                Delete
              </button>
            : (
              <span />
            )}
            <div className="inv-cat-modal-actions-main">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="admin-btn" disabled={busy || !isAdmin}>
                {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add brand"}
              </button>
            </div>
          </div>
          {!isAdmin ?
            <p className="admin-muted">Only admins can add or edit brands.</p>
          : null}
        </form>
      </div>
    </div>
  );
}

function BrandCard({ b, isAdmin, onEdit }) {
  return (
    <li className="inv-product-card inv-brand-card">
      <button type="button" className="inv-product-card-main inv-brand-card-main" onClick={() => onEdit(b)}>
        {b.image_url ?
          <img src={productImageSrc(b.image_url)} alt="" className="inv-product-card-thumb inv-brand-card-logo" />
        : (
          <span className="inv-product-card-thumb inv-thumb-empty inv-cat-icon" aria-hidden="true">
            ™
          </span>
        )}
        <div className="inv-product-card-body">
          <strong>{b.name}</strong>
          <span className="inv-product-card-meta">
            {b.product_count} product{b.product_count === 1 ? "" : "s"} · {b.slug}
          </span>
        </div>
        <span className={`inv-status-pill ${b.status === "active" ? "is-ok" : "is-muted"}`}>{b.status}</span>
      </button>
      <div className="inv-product-card-actions">
        {isAdmin ?
          <button type="button" className="inv-card-action" onClick={() => onEdit(b)}>
            Edit
          </button>
        : null}
        <Link href={`/admin/inventory/products?brand_id=${b.id}`} className="inv-card-action">
          Products
        </Link>
      </div>
    </li>
  );
}

export default function InventoryBrandsApp({ isAdmin = false }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiUrl("/api/admin/inventory/brands"), { credentials: "include" });
    const data = await res.json();
    setLoading(false);
    if (data.ok) setBrands(data.brands || []);
    else showError(data.message || "Could not load brands.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...brands].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((b) => b.name.toLowerCase().includes(q) || String(b.slug || "").includes(q));
  }, [brands, search]);

  function openAdd() {
    setModal({ mode: "add" });
  }

  function openEdit(b) {
    setModal({ mode: "edit", brand: b });
  }

  async function saveBrand(payload) {
    if (!isAdmin) return;
    if (!payload.name) {
      showError("Enter a brand name.");
      return;
    }
    setBusy(true);
    try {
      const isEdit = modal?.mode === "edit";
      const url =
        isEdit ?
          apiUrl(`/api/admin/inventory/brands/${modal.brand.id}`)
        : apiUrl("/api/admin/inventory/brands");
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not save.");
        return;
      }
      showSuccess(isEdit ? "Brand updated." : "Brand added.");
      setModal(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteBrand() {
    if (!modal?.brand?.id || !isAdmin) return;
    const ok = await confirmAction({
      title: "Delete brand?",
      text: `"${modal.brand.name}" will be removed.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inventory/brands/${modal.brand.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not delete.");
        return;
      }
      showSuccess("Brand deleted.");
      setModal(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inventory-app inv-products-list-page inv-pwa-screen">
      <header className="inv-pwa-page-head">
        <Link href="/admin/inventory" className="inv-pwa-back" aria-label="Back">
          ←
        </Link>
        <div className="inv-pwa-head-text">
          <h1>Brands</h1>
          <p className="inv-pwa-head-sub">{filtered.length} total</p>
        </div>
        {isAdmin ?
          <button type="button" className="inv-pwa-head-add admin-btn" onClick={openAdd}>
            Add
          </button>
        : null}
      </header>

      <div className="inv-pwa-search-bar">
        <input
          type="search"
          className="inv-pwa-search-input"
          placeholder="Search brands…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search brands"
        />
      </div>

      <header className="inv-hub-header inv-desktop-only">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory">← Inventory dashboard</Link>
          </p>
          <h1>Brands</h1>
          <p>Manage brands like JBL or boAt — logo plus many products under each name.</p>
        </div>
        {isAdmin ?
          <button type="button" className="admin-btn" onClick={openAdd}>
            + Add brand
          </button>
        : null}
      </header>

      {!isAdmin ?
        <p className="admin-empty inv-desktop-only">Only admins can add or edit brands.</p>
      : null}

      <section className="admin-card inv-table-section inv-table-card">
        <div className="inv-table-toolbar inv-table-toolbar--compact inv-desktop-only">
          <input
            type="search"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search brands"
          />
        </div>

        {loading ?
          <p className="admin-empty inv-pwa-loading">Loading brands…</p>
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="Brands">
              {filtered.map((b) => (
                <BrandCard key={b.id} b={b} isAdmin={isAdmin} onEdit={openEdit} />
              ))}
            </ul>

            {!filtered.length ?
              <div className="inv-qr-empty inv-brand-empty">
                <p>{search.trim() ? "No brands match your search." : "No brands yet."}</p>
                {!search.trim() && isAdmin ?
                  <button type="button" className="admin-btn" onClick={openAdd}>
                    Add your first brand
                  </button>
                : null}
              </div>
            : null}

            {filtered.length ?
              <div className="inv-table-wrap inv-desktop-only">
                <table className="inv-product-table inv-product-table--clean">
                  <thead>
                    <tr>
                      <th>Logo</th>
                      <th>Brand</th>
                      <th>Products</th>
                      <th>Order</th>
                      <th>Status</th>
                      <th className="inv-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {b.image_url ?
                            <img
                              src={productImageSrc(b.image_url)}
                              alt=""
                              className="inv-thumb inv-brand-list-logo"
                            />
                          : (
                            <span className="inv-thumb inv-thumb-empty inv-cat-icon">™</span>
                          )}
                        </td>
                        <td className="inv-col-product">
                          <strong>{b.name}</strong>
                          <span className="inv-brand">{b.slug}</span>
                        </td>
                        <td>{b.product_count}</td>
                        <td>{b.sort_order}</td>
                        <td>
                          <span className={`inv-status-pill ${b.status === "active" ? "is-ok" : "is-muted"}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="inv-col-actions">
                          {isAdmin ?
                            <button type="button" className="inv-text-btn" onClick={() => openEdit(b)}>
                              Edit
                            </button>
                          : null}
                          <Link href={`/admin/inventory/products?brand_id=${b.id}`} className="inv-text-btn">
                            Products
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : null}
          </>
        )}
      </section>

      {isAdmin ?
        <button type="button" className="inv-pwa-fab admin-btn inv-mobile-only" aria-label="Add brand" onClick={openAdd}>
          +
        </button>
      : null}

      <BrandModal
        open={Boolean(modal)}
        mode={modal?.mode || "add"}
        brand={modal?.brand}
        busy={busy}
        isAdmin={isAdmin}
        onClose={() => !busy && setModal(null)}
        onSubmit={saveBrand}
        onDelete={deleteBrand}
      />
    </div>
  );
}
