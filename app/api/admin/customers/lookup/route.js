import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { normalizeCustomerPhone } from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";
import { findUserByPhone } from "@/lib/users";

export async function GET(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const phone = normalizeCustomerPhone(new URL(request.url).searchParams.get("phone") || "");
  if (!phone) {
    return NextResponse.json({ ok: false, message: "Enter a 10-digit mobile number." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const match = await findUserByPhone(db, phone);

    if (!match) {
      return NextResponse.json({ ok: true, found: false, phone });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      phone,
      customer: {
        id: match.id,
        name: match.name,
        phone: match.phone,
        is_customer: match.role === "customer",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not look up customer." }, { status: 500 });
  }
}
