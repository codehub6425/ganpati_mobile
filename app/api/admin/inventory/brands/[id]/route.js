import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { applyBrandImageFields } from "@/lib/brand-image-upload.js";
import { deleteMediaKey } from "@/lib/media-storage.js";
import { loadProductBrand, validateBrandInput } from "@/lib/inventory-brands.js";
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
  const brandId = Number(id);
  if (!brandId) {
    return NextResponse.json({ ok: false, message: "Invalid brand." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = validateBrandInput(body, { partial: true });
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  const d = parsed.data;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const existing = await loadProductBrand(db, brandId);
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Brand not found." }, { status: 404 });
    }

    const fields = [];
    const args = [];
    if (d.name !== undefined) {
      fields.push("name = ?");
      args.push(d.name);
    }
    if (d.slug !== undefined) {
      fields.push("slug = ?");
      args.push(d.slug);
    }
    if (d.sort_order !== undefined) {
      fields.push("sort_order = ?");
      args.push(d.sort_order);
    }
    if (d.status !== undefined) {
      fields.push("status = ?");
      args.push(d.status);
    }

    const imageApply = await applyBrandImageFields(body, brandId, existing.image_storage_key);
    if (imageApply.error) {
      return NextResponse.json({ ok: false, message: imageApply.error }, { status: 400 });
    }
    if (imageApply.image_storage_key !== undefined) {
      fields.push("image_storage_key = ?");
      args.push(imageApply.image_storage_key);
    }

    if (fields.length) {
      args.push(brandId);
      await db.execute(`UPDATE product_brands SET ${fields.join(", ")} WHERE id = ?`, args);
    }

    if (d.name !== undefined) {
      await db.execute("UPDATE products SET brand = ? WHERE brand_id = ?", [d.name, brandId]);
    }

    const brand = await loadProductBrand(db, brandId);
    return NextResponse.json({ ok: true, brand });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "Brand name already exists." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update brand." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  const brandId = Number(id);
  if (!brandId) {
    return NextResponse.json({ ok: false, message: "Invalid brand." }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [[usage]] = await db.query("SELECT COUNT(*) AS n FROM products WHERE brand_id = ?", [brandId]);
    if (Number(usage?.n || 0) > 0) {
      return NextResponse.json(
        { ok: false, message: "Cannot delete: products are still using this brand." },
        { status: 400 }
      );
    }
    const existing = await loadProductBrand(db, brandId);
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Brand not found." }, { status: 404 });
    }
    if (existing.image_storage_key) {
      await deleteMediaKey(existing.image_storage_key);
    }
    await db.execute("DELETE FROM product_brands WHERE id = ?", [brandId]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not delete brand." }, { status: 500 });
  }
}
