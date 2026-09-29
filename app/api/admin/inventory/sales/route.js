import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { createInventorySale, loadSaleById, validateSaleInput } from "@/lib/inventory";
import { parseBookDate, todayDateString } from "@/lib/ledger";
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
  const params = new URL(request.url).searchParams;
  const from = parseBookDate(params.get("from")) || todayDateString();
  const to = parseBookDate(params.get("to")) || from;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query(
      `SELECT s.*, u.name AS created_by_name
       FROM inventory_sales s
       LEFT JOIN users u ON u.id = s.created_by
       WHERE s.sale_date >= ? AND s.sale_date <= ?
       ORDER BY s.created_at DESC
       LIMIT 200`,
      [from, to]
    );
    return NextResponse.json({ ok: true, sales: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load sales." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const parsed = validateSaleInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await createInventorySale(db, auth.user, parsed.data);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, sale: result.sale, profit_total: result.profit_total });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not complete sale." }, { status: 500 });
  }
}
