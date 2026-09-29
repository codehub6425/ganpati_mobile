import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { REQUEST_STATUSES } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function PATCH(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? "").trim();
  const notes = body.notes !== undefined ? String(body.notes).trim().slice(0, 200) : undefined;
  const productId = body.product_id !== undefined ? Number(body.product_id) || null : undefined;

  const updates = [];
  const values = [];
  if (status) {
    if (!REQUEST_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 400 });
    }
    updates.push("status = ?");
    values.push(status);
  }
  if (notes !== undefined) {
    updates.push("notes = ?");
    values.push(notes || null);
  }
  if (productId !== undefined) {
    updates.push("product_id = ?");
    values.push(productId);
  }
  updates.push("handled_by = ?");
  values.push(auth.user.id);
  if (!updates.length) {
    return NextResponse.json({ ok: false, message: "Nothing to update." }, { status: 400 });
  }
  values.push(id);
  try {
    await ensureLeadsTable();
    const db = getPool();
    await db.execute(
      `UPDATE customer_product_requests SET ${updates.join(", ")} WHERE id = ?`,
      values
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update request." }, { status: 500 });
  }
}
