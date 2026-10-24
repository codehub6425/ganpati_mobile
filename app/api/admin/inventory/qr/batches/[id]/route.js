import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { deleteQrBatch, getQrBatchById } from "@/lib/inventory-qr";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid batch." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    const batch = await getQrBatchById(db, id);
    if (!batch) return NextResponse.json({ ok: false, message: "Batch not found." }, { status: 404 });
    const canDelete =
      Number(batch.deletable_count) === Number(batch.count) && Number(batch.count) > 0;
    return NextResponse.json({ ok: true, batch: { ...batch, can_delete: canDelete } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load batch." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid batch." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await deleteQrBatch(db, id);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not delete batch." }, { status: 500 });
  }
}
