import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { slugify } from "@/lib/inventory";
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
    const [rows] = await db.query(
      `SELECT c.id, c.name, c.slug, c.sort_order,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM product_categories c
       ORDER BY c.sort_order, c.name`
    );
    return NextResponse.json({ ok: true, categories: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load categories." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, message: "Category name required." }, { status: 400 });
  }
  const slug = slugify(body.slug || name);
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [result] = await db.execute(
      "INSERT INTO product_categories (name, slug, sort_order) VALUES (?, ?, ?)",
      [name, slug, Number(body.sort_order) || 99]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "Category slug already exists." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not create category." }, { status: 500 });
  }
}
