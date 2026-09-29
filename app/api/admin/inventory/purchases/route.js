import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { createPurchase, listPurchases, validatePurchaseInput } from "@/lib/inventory-purchases";
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
    const purchases = await listPurchases(db);
    return NextResponse.json({ ok: true, purchases });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load purchases." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const parsed = validatePurchaseInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const { purchaseId } = await createPurchase(db, auth.user, parsed.data);
    return NextResponse.json({ ok: true, purchase_id: purchaseId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not save purchase." }, { status: 500 });
  }
}
