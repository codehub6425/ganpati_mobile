import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { formatProductRow, getDashboardKpis } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const kpis = await getDashboardKpis(db);
    const [lowStock] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN product_categories c ON c.id = p.category_id
       WHERE p.status = 'active' AND p.qty_on_hand > 0 AND p.qty_on_hand <= p.min_stock_level
       ORDER BY p.qty_on_hand ASC, p.name ASC
       LIMIT 20`
    );
    const [outOfStock] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN product_categories c ON c.id = p.category_id
       WHERE p.status = 'active' AND p.qty_on_hand <= 0
       ORDER BY p.name ASC
       LIMIT 20`
    );
    return NextResponse.json({
      ok: true,
      kpis,
      low_stock: lowStock.map(formatProductRow),
      out_of_stock: outOfStock.map(formatProductRow),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load dashboard." }, { status: 500 });
  }
}
