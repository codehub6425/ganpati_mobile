import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { deliverAdvanceOrder } from "@/lib/customer-dues.js";
import { isStaffUser } from "@/lib/roles";

export async function POST(_request, { params }) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const resolved = await params;
  const id = Math.floor(Number(resolved?.id));
  if (!id) {
    return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await deliverAdvanceOrder(db, user, id);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("customer-due deliver", error);
    return NextResponse.json({ ok: false, message: "Could not mark delivered." }, { status: 500 });
  }
}
