import { resolveMediaPublicUrl } from "./media-storage.js";
import { slugify } from "./inventory.js";

export function resolveBrandImageUrl(row) {
  const key = row?.image_storage_key;
  if (key) return resolveMediaPublicUrl(key);
  return null;
}

export function formatBrandRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sort_order: Number(row.sort_order) || 99,
    status: row.status || "active",
    image_storage_key: row.image_storage_key || null,
    image_url: resolveBrandImageUrl(row),
    product_count: Number(row.product_count) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listProductBrands(db) {
  const [rows] = await db.query(
    `SELECT b.*,
            (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
     FROM product_brands b
     ORDER BY b.sort_order, b.name`
  );
  return rows.map(formatBrandRow);
}

export async function loadProductBrand(db, id) {
  const brandId = Math.floor(Number(id));
  if (!brandId) return null;
  const [[row]] = await db.query(
    `SELECT b.*,
            (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) AS product_count
     FROM product_brands b
     WHERE b.id = ?
     LIMIT 1`,
    [brandId]
  );
  return row ? formatBrandRow(row) : null;
}

export function validateBrandInput(body, { partial = false } = {}) {
  const name = String(body.name ?? "").trim();
  if (!partial || body.name !== undefined) {
    if (!name) return { error: "Brand name is required." };
  }
  const status = String(body.status ?? "active").trim();
  if (body.status !== undefined && status !== "active" && status !== "inactive") {
    return { error: "Invalid status." };
  }
  const sortOrder = Number(body.sort_order);
  return {
    data: {
      name: name || undefined,
      slug: slugify(body.slug || name),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 99,
      status: status || undefined,
    },
  };
}

/** Resolve brand_id + denormalized brand name for products. */
export async function resolveProductBrandFields(db, brandIdRaw) {
  if (brandIdRaw === null || brandIdRaw === "" || brandIdRaw === undefined) {
    return { brand_id: null, brand: null };
  }
  const brandId = Math.floor(Number(brandIdRaw));
  if (!brandId) return { error: "Invalid brand." };
  const [[row]] = await db.query(
    "SELECT id, name FROM product_brands WHERE id = ? AND status = 'active' LIMIT 1",
    [brandId]
  );
  if (!row) return { error: "Brand not found or inactive." };
  return { brand_id: row.id, brand: row.name };
}
