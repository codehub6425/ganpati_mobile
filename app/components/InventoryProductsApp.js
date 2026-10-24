"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl, productImageSrc } from "@/lib/basePath";
import ProductAddStockModal from "@/app/components/ProductAddStockModal";
import ProductLinkQrModal from "@/app/components/ProductLinkQrModal";
import ListSkeleton from "@/app/components/ListSkeleton";
import ProductRowActions from "@/app/components/ProductRowActions";
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

function ProductCard({ p, onDelete, onLinkQr, onAddStock }) {
  const st = productStatusLabel(p);
  const actions = (
    <ProductRowActions product={p} onLinkQr={onLinkQr} onAddStock={onAddStock} onDelete={onDelete} />
  );
  return (
    <li className={`inv-product-card${p.low_stock ? " is-low-stock" : ""}`}>
      <Link href={`/admin/inventory/products/${p.id}`} className="inv-product-card-main">
        {p.image_url ?
          <img src={productImageSrc(p.image_url)} alt="" className="inv-product-card-thumb" />
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
      <button
        type="button"
        className="inv-stock-add-btn inv-stock-add-btn--card"
        aria-label={`Add stock for ${p.name}`}
        onClick={(e) => onAddStock(p, e)}
      >
        + Add stock
      </button>
      <div className="inv-product-card-actions inv-product-card-actions--menu">{actions}</div>
    </li>
  );
}

export default function InventoryProductsApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEditId = searchParams.get("edit");
  const lowStockUrl = searchParams.get("low_stock") === "1";
  const urlBrandId = searchParams.get("brand_id") || "";

  const [categories, setCategories] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [brandCatalog, setBrandCatalog] = useState([]);
  const [brandIdFilter, setBrandIdFilter] = useState(urlBrandId);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(lowStockUrl);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_BATCH);
  const loadMoreRef = useRef(null);
  const [linkProduct, setLinkProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (urlEditId) {
      router.replace(`/admin/inventory/products/${urlEditId}`);
    }
  }, [urlEditId, router]);

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    fetch(apiUrl("/api/admin/inventory/products/summary"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSummary(j.summary || null);
      })
      .finally(() => setSummaryLoading(false));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/inventory/categories"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCategories(j.categories || []);
      });
    fetch(apiUrl("/api/admin/inventory/brands"), { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setBrandCatalog(j.brands || []);
          setBrandOptions((j.brands || []).map((b) => b.name).sort((a, b) => a.localeCompare(b)));
        }
      });
  }, []);

  useEffect(() => {
    setBrandIdFilter(urlBrandId);
  }, [urlBrandId]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (categoryId) qs.set("category_id", categoryId);
    if (brandIdFilter) qs.set("brand_id", brandIdFilter);
    else if (brand) qs.set("brand", brand);
    if (statusFilter) qs.set("status", statusFilter);
    if (lowStockOnly) qs.set("low_stock", "1");
    if (outOfStockOnly) qs.set("out_of_stock", "1");
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
  }, [search, categoryId, brand, brandIdFilter, statusFilter, lowStockOnly, outOfStockOnly, productTypeFilter]);

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
    brandIdFilter,
    statusFilter,
    productTypeFilter,
    lowStockOnly,
    outOfStockOnly,
  ].filter(Boolean).length;

  function focusLowStock() {
    setOutOfStockOnly(false);
    setLowStockOnly(true);
    setPage(1);
  }

  function focusOutOfStock() {
    setLowStockOnly(false);
    setOutOfStockOnly(true);
    setPage(1);
  }

  const hasActiveFilters =
    Boolean(search.trim()) || activeFilterCount > 0;

  const showSetupGuide = !loading && !hasActiveFilters && products.length === 0;

  function openLinkQr(p, e) {
    e.preventDefault();
    e.stopPropagation();
    setLinkProduct(p);
  }

  function openAddStock(p, e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setStockProduct(p);
  }

  function onStockUpdated(updated) {
    if (!updated?.id) {
      loadProducts();
      loadSummary();
      return;
    }
    setProducts((list) => list.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    loadSummary();
  }

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
    loadSummary();
    loadProducts();
  }

  function clearFilters() {
    setCategoryId("");
    setBrand("");
    setBrandIdFilter("");
    setStatusFilter("");
    setProductTypeFilter("");
    setLowStockOnly(false);
    setOutOfStockOnly(false);
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
      {brandCatalog.length ?
        <select value={brandIdFilter} onChange={(e) => setBrandIdFilter(e.target.value)} aria-label="Brand">
          <option value="">All brands</option>
          {brandCatalog.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      : brandOptions.length ?
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
          <p className="inv-pwa-head-sub">
            {summary?.active_products ?? products.length} in catalog
            {summary?.low_stock_count ?
              ` · ${summary.low_stock_count} low`
            : ""}
          </p>
        </div>
        <div className="inv-pwa-head-actions">
          <Link href="/admin/inventory/stock/add" className="inv-pwa-head-add admin-btn admin-btn-secondary">
            Stock
          </Link>
          <Link href="/admin/inventory/products/new" className="inv-pwa-head-add admin-btn">
            Add
          </Link>
        </div>
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
        <div className="inv-dash-head-actions">
          <Link href="/admin/inventory/stock/add" className="admin-btn admin-btn-secondary">
            Add stock
          </Link>
          <Link href="/admin/inventory/products/new" className="admin-btn">
            + Add product
          </Link>
        </div>
      </header>

      <section className="inv-product-mgmt-strip" aria-label="Manage inventory">
        <div className="inv-product-mgmt-actions">
          <Link href="/admin/inventory/stock/add" className="admin-btn inv-product-mgmt-action">
            Add stock
          </Link>
          <Link href="/admin/inventory/purchases#record-purchase" className="admin-btn admin-btn-secondary inv-product-mgmt-action">
            Record purchase
          </Link>
          <Link href="/admin/inventory/scan" className="inv-quick-chip">
            Scan to sell
          </Link>
          <Link href="/admin/inventory/sales/new" className="inv-quick-chip">
            New sale
          </Link>
        </div>
        {summaryLoading && !summary ?
          <div className="inv-product-mgmt-stats inv-product-mgmt-stats--loading" aria-busy="true">
            <span className="inv-skeleton inv-skeleton-stat-card" />
            <span className="inv-skeleton inv-skeleton-stat-card" />
            <span className="inv-skeleton inv-skeleton-stat-card" />
          </div>
        : summary ?
          <div className="inv-product-mgmt-stats">
            <article className="inv-product-stat-card">
              <span className="inv-product-stat-label">In catalog</span>
              <strong>{summary.active_products}</strong>
              <small>{summary.total_stock_qty} units on hand</small>
            </article>
            <button
              type="button"
              className={`inv-product-stat-card is-clickable${lowStockOnly ? " is-active" : ""}${summary.low_stock_count ? " is-warn" : ""}`}
              onClick={focusLowStock}
            >
              <span className="inv-product-stat-label">Low stock alert</span>
              <strong>{summary.low_stock_count}</strong>
              <small>Tap to filter list</small>
            </button>
            <button
              type="button"
              className={`inv-product-stat-card is-clickable${outOfStockOnly ? " is-active" : ""}${summary.out_of_stock_count ? " is-danger" : ""}`}
              onClick={focusOutOfStock}
            >
              <span className="inv-product-stat-label">Out of stock</span>
              <strong>{summary.out_of_stock_count}</strong>
              <small>Tap to filter list</small>
            </button>
            <article className="inv-product-stat-card">
              <span className="inv-product-stat-label">Total sold</span>
              <strong>{formatMoney(summary.total_units_sold)}</strong>
              <small>
                Today: {summary.sold_today_units} unit{summary.sold_today_units === 1 ? "" : "s"}
                {summary.sold_today_count ? ` · ${summary.sold_today_count} sale(s)` : ""}
              </small>
            </article>
            {summary.last_product ?
              <Link href={`/admin/inventory/products/${summary.last_product.id}`} className="inv-product-stat-card is-link">
                <span className="inv-product-stat-label">Last added</span>
                <strong className="inv-product-stat-name">{summary.last_product.name}</strong>
                <small>
                  {summary.last_product.created_at ?
                    new Date(summary.last_product.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : "View product"}
                  {" · "}
                  {summary.last_product.qty_on_hand} in stock
                </small>
              </Link>
            : null}
          </div>
        : null}
      </section>

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
          <ListSkeleton variant="product" rows={8} />
        : (
          <>
            <ul className="inv-product-cards inv-mobile-only" aria-label="Product list">
              {mobileProducts.map((p) => (
                <ProductCard key={p.id} p={p} onDelete={deleteProduct} onLinkQr={openLinkQr} onAddStock={openAddStock} />
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
                              <img src={productImageSrc(p.image_url)} alt="" className="inv-thumb" />
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
                        <td className={p.low_stock || p.out_of_stock ? "inv-stock-warn" : ""}>
                          <span className="inv-stock-cell">
                            {p.qty_on_hand}
                            <button
                              type="button"
                              className="inv-stock-add-btn"
                              title="Add stock"
                              aria-label={`Add stock for ${p.name}`}
                              onClick={(e) => openAddStock(p, e)}
                            >
                              +
                            </button>
                          </span>
                        </td>
                        <td>₹ {formatMoney(p.selling_price)}</td>
                        <td>
                          <span className={`inv-status-pill ${st.className}`}>{st.text}</span>
                        </td>
                        <td className="inv-col-actions">
                          <ProductRowActions
                            product={p}
                            onLinkQr={openLinkQr}
                            onAddStock={openAddStock}
                            onDelete={deleteProduct}
                          />
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

      <ProductLinkQrModal
        product={linkProduct}
        open={Boolean(linkProduct)}
        onClose={() => setLinkProduct(null)}
        onLinked={() => loadProducts()}
      />

      {stockProduct ?
        <ProductAddStockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSuccess={onStockUpdated}
        />
      : null}
    </div>
  );
}
