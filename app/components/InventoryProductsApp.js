"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/basePath";
import { confirmAction, showError, showSuccess } from "@/lib/swal";

const PAGE_SIZE = 15;
const MOBILE_BATCH = 20;

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function productStatusLabel(p) {
  if (p.out_of_stock) return { text: "Out of stock", className: "is-danger" };
  if (p.status === "inactive") return { text: "Inactive", className: "is-muted" };
  return { text: "Active", className: "is-ok" };
}

function ProductCard({ p, onDelete }) {
  const st = productStatusLabel(p);
  return (
    <li className={`inv-product-card${p.low_stock ? " is-low-stock" : ""}`}>
      <Link href={`/admin/inventory/products/${p.id}`} className="inv-product-card-main">
        {p.image_url ?
          <img src={p.image_url} alt="" className="inv-product-card-thumb" />
        : (
          <span className="inv-product-card-thumb inv-thumb-empty" aria-hidden="true">
            📦
          </span>
        )}
        <div className="inv-product-card-body">
          <strong>{p.name}</strong>
          <span className="inv-product-card-meta">
            {p.category_name || "Uncategorized"}
            {p.product_type === "serialized" ? " · QR" : " · Qty"}
          </span>
          <span className="inv-product-card-price">
            ₹ {formatMoney(p.selling_price)}
            <span className={`inv-product-card-stock${p.low_stock || p.out_of_stock ? " is-warn" : ""}`}>
              · {p.qty_on_hand} in stock
            </span>
          </span>
        </div>
        <span className={`inv-status-pill ${st.className}`}>{st.text}</span>
      </Link>
      <div className="inv-product-card-actions">
        <Link href={`/admin/inventory/products/${p.id}`} className="inv-card-action">
          Edit
        </Link>
        <button type="button" className="inv-card-action is-danger" onClick={(e) => onDelete(p, e)}>
          Delete
        </button>
      </div>
    </li>
  );
}

export default function InventoryProductsApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEditId = searchParams.get("edit");
  const lowStockUrl = searchParams.get("low_stock") === "1";

  const [categories, setCategories] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(lowStockUrl);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_BATCH);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    if (urlEditId) {
      router.replace(`/admin/inventory/products/${urlEditId}`);
    }
  }, [urlEditId, router]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/categories"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCategories(j.categories || []);
      });
    fetch(apiUrl("/api/admin/inventory/products?limit=500"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          const brands = [
            ...new Set(
              (j.products || [])
                .map((p) => (p.brand || "").trim())
                .filter(Boolean)
            ),
          ].sort((a, b) => a.localeCompare(b));
          setBrandOptions(brands);
        }
      });
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (categoryId) qs.set("category_id", categoryId);
    if (brand) qs.set("brand", brand);
    if (statusFilter) qs.set("status", statusFilter);
    if (lowStockOnly) qs.set("low_stock", "1");
    if (productTypeFilter) qs.set("product_type", productTypeFilter);
    const res = await fetch(apiUrl(`/api/admin/inventory/products?${qs}`), {
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Could not load products.");
      return;
    }
    setProducts(data.products || []);
    setError("");
    setPage(1);
    setMobileVisibleCount(MOBILE_BATCH);
  }, [search, categoryId, brand, statusFilter, lowStockOnly, productTypeFilter]);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(), search ? 280 : 0);
    return () => clearTimeout(t);
  }, [loadProducts, search]);

  const pageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pageProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, page]);

  const mobileProducts = useMemo(
    () => products.slice(0, mobileVisibleCount),
    [products, mobileVisibleCount]
  );

  const hasMoreMobile = mobileVisibleCount < products.length;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMobileVisibleCount((c) => Math.min(c + MOBILE_BATCH, products.length));
        }
      },
      { root: null, rootMargin: "160px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreMobile, products.length]);

  const activeFilterCount = [
    categoryId,
    brand,
    statusFilter,
    productTypeFilter,
    lowStockOnly,
  ].filter(Boolean).length;

  const hasActiveFilters =
    Boolean(search.trim()) || activeFilterCount > 0;

  const showSetupGuide = !loading && !hasActiveFilters && products.length === 0;

  async function deleteProduct(p, e) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirmAction({
      title: "Delete product?",
      text: `"${p.name}" will be removed from inventory.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const res = await fetch(apiUrl(`/api/admin/inventory/products/${p.id}`), {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.message || "Could not delete.");
      return;
    }
    showSuccess("Product deleted.");
    loadProducts();
  }

  function clearFilters() {
    setCategoryId("");
    setBrand("");
    setStatusFilter("");
    setProductTypeFilter("");
    setLowStockOnly(false);
  }

  const showingFrom = products.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, products.length);

  const filterFields = (
    <>
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Category">
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)} aria-label="Type">
        <option value="">All types</option>
        <option value="quantity">Quantity</option>
        <option value="serialized">Serialized</option>
      </select>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
        <option value="">All status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      {brandOptions.length ?
        <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">
          <option value="">All brands</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      : null}
      <label className="inv-filter-check">
        <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
        Low stock only
      </label>
    </>
  );

  return (
    <div className="inventory-app inv-products-list-page inv-pwa-screen">
      <header className="inv-pwa-page-head">
        <Link href="/admin/inventory" className="inv-pwa-back" aria-label="Back to inventory">
          ←
        </Link>
        <div className="inv-pwa-head-text">
          <h1>Products</h1>
          <p className="inv-pwa-head-sub">{products.length} in catalog</p>
        </div>
        <Link href="/admin/inventory/products/new" className="inv-pwa-head-add admin-btn">
          Add
        </Link>
      </header>

      <div className="inv-pwa-search-bar">
        <input
          type="search"
          className="inv-pwa-search-input"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <button
          type="button"
          className={`inv-pwa-filter-btn${filtersOpen ? " is-open" : ""}${activeFilterCount ? " has-filters" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          Filters
          {activeFilterCount ?
            <span className="inv-pwa-filter-badge">{activeFilterCount}</span>
          : null}
        </button>
      </div>

      <div className={`inv-pwa-filters${filtersOpen ? " is-open" : ""}`}>
        <div className="inv-pwa-filters-inner">{filterFields}</div>
        {activeFilterCount ?
          <button type="button" className="inv-pwa-clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        : null}
      </div>

      <header className="inv-hub-header inv-desktop-only">
        <div>
          <p className="inv-list-back">
            <Link href="/admin/inventory">← Inventory dashboard</Link>
          </p>
          <h1>Products</h1>
          <p>Search and manage your catalog.</p>
        </div>
        <Link href="/admin/inventory/products/new" className="admin-btn">
          + Add product
        </Link>
      </header>

      {showSetupGuide ?
        <section className="admin-card inv-setup-guide">
          <h2>Get started</h2>
          <ol>
            <li>
              <Link href="/admin/inventory/qr">Print QR stickers</Link>
            </li>
            <li>
              <Link href="/admin/inventory/products/new">Add a serialized product</Link>
            </li>
            <li>
              <Link href="/admin/inventory/stock/add">Scan to link stock</Link>
            </li>
          </ol>
        </section>
      : null}

      <section className="admin-card inv-table-section inv-table-card">
        <div className="inv-table-toolbar inv-table-toolbar--compact inv-desktop-only">{filterFields}</div>

        {error ?
          <p className="admin-empty">{error}</p>
        : null}
        {loading ?
          <p className="admin-empty inv-pwa-loading">Loading products…</p>
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="Product list">
              {mobileProducts.map((p) => (
                <ProductCard key={p.id} p={p} onDelete={deleteProduct} />
              ))}
            </ul>

            {hasMoreMobile && !loading ?
              <div ref={loadMoreRef} className="inv-infinite-sentinel inv-mobile-only" aria-hidden="true">
                <span className="inv-infinite-spinner" />
                <span>Loading more…</span>
              </div>
            : null}

            {products.length > 0 && !hasMoreMobile && !loading ?
              <p className="inv-infinite-done inv-mobile-only">
                Showing all {products.length} product{products.length === 1 ? "" : "s"}
              </p>
            : null}

            {!products.length ?
              <p className="admin-empty">No products found.</p>
            : null}

            <div className="inv-table-wrap inv-desktop-only">
              <table className="inv-product-table inv-product-table--clean">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Type</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Price</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="inv-col-actions">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageProducts.map((p) => {
                    const st = productStatusLabel(p);
                    return (
                      <tr key={p.id} className={p.low_stock ? "is-low-stock" : ""}>
                        <td className="inv-col-product">
                          <Link href={`/admin/inventory/products/${p.id}`} className="inv-product-cell inv-product-row-link">
                            {p.image_url ?
                              <img src={p.image_url} alt="" className="inv-thumb" />
                            : (
                              <span className="inv-thumb inv-thumb-empty" aria-hidden="true">
                                📦
                              </span>
                            )}
                            <div>
                              <strong>{p.name}</strong>
                              <span className="inv-brand">
                                {[p.sku, p.brand].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td>{p.category_name || "—"}</td>
                        <td>{p.product_type === "serialized" ? "Serialized" : "Quantity"}</td>
                        <td className={p.low_stock || p.out_of_stock ? "inv-stock-warn" : ""}>{p.qty_on_hand}</td>
                        <td>₹ {formatMoney(p.selling_price)}</td>
                        <td>
                          <span className={`inv-status-pill ${st.className}`}>{st.text}</span>
                        </td>
                        <td className="inv-col-actions">
                          <Link href={`/admin/inventory/products/${p.id}`} className="inv-text-btn">
                            Edit
                          </Link>
                          <button type="button" className="inv-text-btn is-danger" onClick={(e) => deleteProduct(p, e)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {products.length > 0 ?
              <footer className="inv-table-footer inv-pwa-footer inv-desktop-only">
                <span>
                  {showingFrom}–{showingTo} of {products.length}
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

      <Link href="/admin/inventory/products/new" className="inv-pwa-fab admin-btn inv-mobile-only" aria-label="Add product">
        +
      </Link>
    </div>
  );
}
