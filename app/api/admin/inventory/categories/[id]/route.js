import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { slugify } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { error: NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 }) };
  }
  return { user };
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  const categoryId = Number(id);
  if (!categoryId) {
    return NextResponse.json({ ok: false, message: "Invalid category." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, message: "Category name required." }, { status: 400 });
  }
  const slug = slugify(body.slug || name);
  const sortOrder = Number(body.sort_order);
  try {
    await ensureLeadsTable();
    const db = getPool();
    await db.execute(
      "UPDATE product_categories SET name = ?, slug = ?, sort_order = ? WHERE id = ?",
      [name, slug, Number.isFinite(sortOrder) ? sortOrder : 99, categoryId]
    );
    const [[row]] = await db.query(
      `SELECT c.id, c.name, c.slug, c.sort_order,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM product_categories c WHERE c.id = ?`,
      [categoryId]
    );
    if (!row) {
      return NextResponse.json({ ok: false, message: "Category not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, category: row });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "Category slug already exists." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update category." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  const categoryId = Number(id);
  if (!categoryId) {
    return NextResponse.json({ ok: false, message: "Invalid category." }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [[usage]] = await db.query("SELECT COUNT(*) AS n FROM products WHERE category_id = ?", [categoryId]);
    if (Number(usage?.n || 0) > 0) {
      return NextResponse.json(
        { ok: false, message: "Cannot delete: products are still using this category." },
        { status: 400 }
      );
    }
    const [result] = await db.execute("DELETE FROM product_categories WHERE id = ?", [categoryId]);
    if (result.affectedRows === 0) {
      return NextResponse.json({ ok: false, message: "Category not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not delete category." }, { status: 500 });
  }
}
