import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { recordCustomerDuePayment } from "@/lib/customer-dues.js";
import { isStaffUser } from "@/lib/roles";

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const resolved = await params;
  const id = Math.floor(Number(resolved?.id));
  if (!id) {
    return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await recordCustomerDuePayment(db, user, id, body);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("customer-due payment", error);
    return NextResponse.json({ ok: false, message: "Could not record payment." }, { status: 500 });
  }
}
