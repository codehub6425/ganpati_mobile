import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { recordSupplierPayment, validateSupplierPaymentInput } from "@/lib/inventory-suppliers";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function POST(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const resolved = await params;
  const supplierId = resolved?.id;
  const body = await request.json().catch(() => ({}));
  const parsed = validateSupplierPaymentInput({ ...body, supplier_id: supplierId });
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await recordSupplierPayment(db, auth.user, parsed.data);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not record payment." }, { status: 500 });
  }
}
