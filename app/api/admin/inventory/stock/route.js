import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { applyStockMovement, formatProductRow, MOVEMENT_TYPES } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const productId = Number(body.product_id);
  const qty = Math.floor(Number(body.qty));
  const type = String(body.movement_type || "purchase").trim();
  if (!productId || !Number.isFinite(qty) || qty === 0) {
    return NextResponse.json({ ok: false, message: "Invalid product or quantity." }, { status: 400 });
  }
  if (!MOVEMENT_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, message: "Invalid movement type." }, { status: 400 });
  }
  let qtyDelta = qty;
  if (type === "sale") qtyDelta = -Math.abs(qty);
  else if (type === "purchase" || type === "return") qtyDelta = Math.abs(qty);
  else if (type === "adjustment") qtyDelta = qty;

  const conn = await getPool().getConnection();
  try {
    await ensureLeadsTable();
    const [ptype] = await conn.query("SELECT product_type FROM products WHERE id = ? LIMIT 1", [productId]);
    if (ptype[0]?.product_type === "serialized") {
      return NextResponse.json(
        {
          ok: false,
          message: "Serialized products use QR scan → add stock. Open Inventory → Add stock.",
        },
        { status: 400 }
      );
    }
    await conn.beginTransaction();
    const nextQty = await applyStockMovement(conn, {
      productId,
      movementType: type,
      qtyDelta,
      unitCost: body.unit_cost != null ? Number(body.unit_cost) : null,
      note: body.note,
      createdBy: auth.user.id,
    });
    await conn.commit();
    const db = getPool();
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name FROM products p
       JOIN product_categories c ON c.id = p.category_id WHERE p.id = ?`,
      [productId]
    );
    return NextResponse.json({
      ok: true,
      qty_on_hand: nextQty,
      product: rows[0] ? formatProductRow(rows[0]) : null,
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    return NextResponse.json(
      { ok: false, message: error.message || "Could not update stock." },
      { status: 400 }
    );
  } finally {
    conn.release();
  }
}
