import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { linkQrUnit } from "@/lib/inventory-qr";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await linkQrUnit(db, auth.user, body);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not link QR." }, { status: 500 });
  }
}
