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

async function loadProduct(db, id) {
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name FROM products p
     JOIN product_categories c ON c.id = p.category_id WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function GET(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    const row = await loadProduct(db, id);
    if (!row) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, product: formatProductRow(row) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load product." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const parsed = validateProductInput(body, { partial: true });
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  const d = parsed.data;
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(d)) {
    if (val === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (!fields.length) {
    return NextResponse.json({ ok: false, message: "Nothing to update." }, { status: 400 });
  }
  values.push(id);
  try {
    await ensureLeadsTable();
    const db = getPool();
    await db.execute(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`, values);
    const row = await loadProduct(db, id);
    if (!row) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, product: formatProductRow(row) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "SKU already in use." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update product." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    await db.execute("UPDATE products SET status = 'inactive' WHERE id = ?", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not deactivate product." }, { status: 500 });
  }
}
