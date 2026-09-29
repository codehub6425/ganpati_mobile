import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { lookupQrCode } from "@/lib/inventory-qr";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.json({ ok: false, message: "Code is required." }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await lookupQrCode(db, code);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 404 });
    }
    const [movements] = await db.query(
      `SELECT m.* FROM stock_movements m
       JOIN qr_units q ON q.product_id = m.product_id
       WHERE q.code = ?
       ORDER BY m.id DESC LIMIT 20`,
      [String(code).trim().toUpperCase()]
    );
    return NextResponse.json({ ok: true, ...result, movements });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Lookup failed." }, { status: 500 });
  }
}
