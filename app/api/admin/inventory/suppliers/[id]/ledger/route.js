import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getSupplierLedger } from "@/lib/inventory-suppliers";
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
  const resolved = await params;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const ledger = await getSupplierLedger(db, resolved?.id);
    if (!ledger) {
      return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...ledger });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load ledger." }, { status: 500 });
  }
}
