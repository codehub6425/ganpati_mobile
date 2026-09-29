import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { formatProductRow, validateProductInput } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const search = String(params.get("search") || "").trim();
  const categoryId = params.get("category_id");
  const status = params.get("status");
  const brand = String(params.get("brand") || "").trim();
  const lowStock = params.get("low_stock") === "1";
  const forSale = params.get("for_sale") === "1";
  const productType = params.get("product_type");

  try {
    await ensureLeadsTable();
    const db = getPool();
    const where = [];
    const args = [];
    if (forSale) {
      where.push("p.status = 'active'");
      where.push("p.qty_on_hand > 0");
    } else if (status) {
      where.push("p.status = ?");
      args.push(status);
    }
    if (categoryId) {
      where.push("p.category_id = ?");
      args.push(Number(categoryId));
    }
    if (brand) {
      where.push("p.brand = ?");
      args.push(brand);
    }
    if (productType === "quantity" || productType === "serialized") {
      where.push("p.product_type = ?");
      args.push(productType);
    }
    if (search) {
      where.push("(p.name LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)");
      const q = `%${search}%`;
      args.push(q, q, q);
    }
    if (lowStock) {
      where.push("p.status = 'active' AND p.qty_on_hand > 0 AND p.qty_on_hand <= p.min_stock_level");
    }
    const sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN product_categories c ON c.id = p.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY p.name ASC
      LIMIT 500`;
    const [rows] = await db.query(sql, args);
    return NextResponse.json({ ok: true, products: rows.map(formatProductRow) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load products." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const parsed = validateProductInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  const d = parsed.data;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [cat] = await db.query("SELECT id FROM product_categories WHERE id = ? LIMIT 1", [d.category_id]);
    if (!cat[0]) {
      return NextResponse.json({ ok: false, message: "Category not found." }, { status: 400 });
    }
    const productType = d.product_type || "quantity";
    const initialQty =
      productType === "serialized" ? 0 : Math.max(0, Math.floor(Number(body.qty_on_hand) || 0));
    const [result] = await db.execute(
      `INSERT INTO products
        (category_id, name, brand, sku, purchase_price, mrp, selling_price, discount_pct, qty_on_hand, min_stock_level, supplier, image_url, warranty_text, status, product_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.category_id,
        d.name,
        d.brand,
        d.sku,
        d.purchase_price,
        d.mrp,
        d.selling_price,
        d.discount_pct,
        initialQty,
        d.min_stock_level ?? 0,
        d.supplier,
        d.image_url,
        d.warranty_text,
        d.status || "active",
        productType,
      ]
    );
    const productId = result.insertId;
    if (initialQty > 0) {
      await db.execute(
        `INSERT INTO stock_movements (product_id, movement_type, qty_delta, unit_cost, note, created_by)
         VALUES (?, 'purchase', ?, ?, 'Initial stock', ?)`,
        [productId, initialQty, d.purchase_price, auth.user.id]
      );
    }
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name FROM products p
       JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );
    return NextResponse.json({ ok: true, product: formatProductRow(rows[0]) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "SKU already in use." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not create product." }, { status: 500 });
  }
}
