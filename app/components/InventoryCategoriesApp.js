"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

const PAGE_SIZE = 15;
const MOBILE_BATCH = 20;

function CategoryModal({ open, mode, category, busy, onClose, onSubmit, onDelete }) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("99");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && category) {
      setName(category.name || "");
      setSortOrder(String(category.sort_order ?? 99));
    } else {
      setName("");
      setSortOrder("99");
    }
  }, [open, mode, category]);

  if (!open) return null;

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="inv-cat-modal-title">
      <button type="button" className="admin-modal-backdrop" onClick={onClose} aria-label="Close" />
      <div className="admin-modal-card inv-cat-modal-card">
        <header className="admin-modal-head">
          <div>
            <h3 id="inv-cat-modal-title">{mode === "edit" ? "Edit category" : "Add category"}</h3>
            <p>{mode === "edit" ? "Update name or sort order." : "Create a category for products."}</p>
          </div>
          <button type="button" className="inv-modal-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <form
          className="inv-cat-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: name.trim(), sort_order: Number(sortOrder) || 99 });
          }}
        >
          <label className="inv-cat-modal-label">
            <span>Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mobile phone"
              autoFocus
            />
          </label>
          <label className="inv-cat-modal-label">
            <span>Sort order</span>
            <input
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="99"
            />
          </label>
          {mode === "edit" && category ?
            <p className="inv-cat-modal-meta">
              Slug: <code>{category.slug}</code>
              {Number(category.product_count) > 0 ?
                <> · {category.product_count} product(s)</>
              : null}
            </p>
          : null}
          <div className="inv-cat-modal-actions">
            {mode === "edit" && onDelete ?
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
              <button type="submit" className="admin-btn" disabled={busy}>
                {busy ? "Saving…" : mode === "edit" ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryCard({ c, isAdmin, onEdit, onDelete }) {
  return (
    <li className="inv-product-card">
      <button type="button" className="inv-product-card-main inv-cat-card-main" onClick={() => isAdmin && onEdit(c)}>
        <span className="inv-product-card-thumb inv-cat-icon" aria-hidden="true">
          🏷️
        </span>
        <div className="inv-product-card-body">
          <strong>{c.name}</strong>
          <span className="inv-product-card-meta">{c.slug}</span>
          <span className="inv-product-card-price">
            Sort {c.sort_order}
            <span className="inv-product-card-stock"> · {c.product_count ?? 0} products</span>
          </span>
        </div>
      </button>
      {isAdmin ?
        <div className="inv-product-card-actions">
          <button type="button" className="inv-card-action" onClick={() => onEdit(c)}>
            Edit
          </button>
          <button
            type="button"
            className="inv-card-action is-danger"
            onClick={(e) => onDelete(c, e)}
            disabled={Number(c.product_count) > 0}
          >
            Delete
          </button>
        </div>
      : null}
    </li>
  );
}

export default function InventoryCategoriesApp({ isAdmin = false }) {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_BATCH);
  const loadMoreRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(apiUrl("/api/admin/inventory/categories"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setCategories(j.categories || []);
          setPage(1);
          setMobileVisibleCount(MOBILE_BATCH);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.slug && c.slug.toLowerCase().includes(q))
    );
  }, [categories, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const mobileItems = useMemo(() => filtered.slice(0, mobileVisibleCount), [filtered, mobileVisibleCount]);
  const hasMoreMobile = mobileVisibleCount < filtered.length;

  useEffect(() => {
    setMobileVisibleCount(MOBILE_BATCH);
    setPage(1);
  }, [search, categories.length]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreMobile) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMobileVisibleCount((c) => Math.min(c + MOBILE_BATCH, filtered.length));
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreMobile, filtered.length]);

  function openAdd() {
    setModal({ mode: "add", category: null });
  }

  function openEdit(c) {
    setModal({ mode: "edit", category: c });
  }

  function closeModal() {
    if (!busy) setModal(null);
  }

  async function saveCategory(payload) {
    if (!payload.name) {
      showError("Enter a category name.");
      return;
    }
    setBusy(true);
    try {
      const isEdit = modal?.mode === "edit";
      const url =
        isEdit ?
          apiUrl(`/api/admin/inventory/categories/${modal.category.id}`)
        : apiUrl("/api/admin/inventory/categories");
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
      showSuccess(isEdit ? "Category updated." : "Category added.");
      setModal(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(c, e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (Number(c.product_count) > 0) {
      showError("Remove or reassign products before deleting this category.");
      return;
    }
    const ok = await confirmAction({
      title: "Delete category?",
      text: `"${c.name}" will be removed permanently.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/inventory/categories/${c.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.message || "Could not delete.");
        return;
      }
      showSuccess("Category deleted.");
      setModal(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  const showingFrom = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="inventory-app inv-products-list-page inv-pwa-screen">
      <header className="inv-pwa-page-head">
        <Link href="/admin/inventory" className="inv-pwa-back" aria-label="Back to inventory">
          ←
        </Link>
        <div className="inv-pwa-head-text">
          <h1>Categories</h1>
          <p className="inv-pwa-head-sub">{filtered.length} total</p>
        </div>
      </header>

      <div className="inv-pwa-search-bar">
        <input
          type="search"
          className="inv-pwa-search-input"
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search categories"
        />
      </div>

      <header className="inv-hub-header inv-desktop-only">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory">← Inventory dashboard</Link>
          </p>
          <h1>Categories</h1>
          <p>Group products for filters and reporting.</p>
        </div>
        {isAdmin ?
          <button type="button" className="admin-btn" onClick={openAdd}>
            + Add category
          </button>
        : null}
      </header>

      {!isAdmin ?
        <p className="admin-empty inv-desktop-only">Only admins can add or edit categories.</p>
      : null}

      <section className="admin-card inv-table-section inv-table-card">
        <div className="inv-table-toolbar inv-table-toolbar--compact inv-desktop-only">
          <input
            type="search"
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search categories"
          />
        </div>

        {loading ?
          <p className="admin-empty inv-pwa-loading">Loading…</p>
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="Categories">
              {mobileItems.map((c) => (
                <CategoryCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteCategory} />
              ))}
            </ul>

            {hasMoreMobile && !loading ?
              <div ref={loadMoreRef} className="inv-infinite-sentinel inv-mobile-only" aria-hidden="true">
                <span className="inv-infinite-spinner" />
                <span>Loading more…</span>
              </div>
            : null}

            {filtered.length > 0 && !hasMoreMobile && !loading ?
              <p className="inv-infinite-done inv-mobile-only">
                Showing all {filtered.length} categor{filtered.length === 1 ? "y" : "ies"}
              </p>
            : null}

            {!filtered.length ?
              <p className="admin-empty">No categories found.</p>
            : null}

            <div className="inv-table-wrap inv-desktop-only">
              <table className="inv-product-table inv-product-table--clean">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Sort</th>
                    <th scope="col">Products</th>
                    {isAdmin ?
                      <th scope="col" className="inv-col-actions">
                        Actions
                      </th>
                    : null}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.slug}</td>
                      <td>{c.sort_order}</td>
                      <td>{c.product_count ?? 0}</td>
                      {isAdmin ?
                        <td className="inv-col-actions">
                          <button type="button" className="inv-text-btn" onClick={() => openEdit(c)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inv-text-btn is-danger"
                            disabled={Number(c.product_count) > 0}
                            onClick={(e) => deleteCategory(c, e)}
                          >
                            Delete
                          </button>
                        </td>
                      : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 ?
              <footer className="inv-table-footer inv-desktop-only">
                <span>
                  {showingFrom}–{showingTo} of {filtered.length}
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

      {isAdmin ?
        <>
          <button type="button" className="inv-pwa-fab admin-btn inv-mobile-only" aria-label="Add category" onClick={openAdd}>
            +
          </button>
          <CategoryModal
            open={Boolean(modal)}
            mode={modal?.mode || "add"}
            category={modal?.category}
            busy={busy}
            onClose={closeModal}
            onSubmit={saveCategory}
            onDelete={modal?.mode === "edit" ? () => deleteCategory(modal.category) : null}
          />
        </>
      : null}
    </div>
  );
}
