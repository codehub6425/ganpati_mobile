import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { applyBrandImageFields } from "@/lib/brand-image-upload.js";
import { listProductBrands, validateBrandInput } from "@/lib/inventory-brands.js";
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
    const brands = await listProductBrands(db);
    return NextResponse.json({ ok: true, brands });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load brands." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ ok: false, message: "Admin only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = validateBrandInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  const d = parsed.data;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [result] = await db.execute(
      "INSERT INTO product_brands (name, slug, sort_order, status) VALUES (?, ?, ?, ?)",
      [d.name, d.slug, d.sort_order ?? 99, d.status || "active"]
    );
    const brandId = result.insertId;
    const imageApply = await applyBrandImageFields(body, brandId, null);
    if (imageApply.error) {
      return NextResponse.json({ ok: false, message: imageApply.error }, { status: 400 });
    }
    if (imageApply.image_storage_key !== undefined) {
      await db.execute("UPDATE product_brands SET image_storage_key = ? WHERE id = ?", [
        imageApply.image_storage_key,
        brandId,
      ]);
    }
    const { loadProductBrand } = await import("@/lib/inventory-brands.js");
    const brand = await loadProductBrand(db, brandId);
    return NextResponse.json({ ok: true, brand });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "Brand name already exists." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not create brand." }, { status: 500 });
  }
}
