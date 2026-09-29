import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { REQUEST_STATUSES, validateRequestInput } from "@/lib/inventory";
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
  const status = new URL(request.url).searchParams.get("status");
  try {
    await ensureLeadsTable();
    const db = getPool();
    const where = status && REQUEST_STATUSES.includes(status) ? "WHERE r.status = ?" : "";
    const args = where ? [status] : [];
    const [rows] = await db.query(
      `SELECT r.*, u.name AS handled_by_name, p.name AS linked_product_name
       FROM customer_product_requests r
       LEFT JOIN users u ON u.id = r.handled_by
       LEFT JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY r.request_date DESC, r.id DESC
       LIMIT 200`,
      args
    );
    return NextResponse.json({ ok: true, requests: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load requests." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const parsed = validateRequestInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }
  const d = parsed.data;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [result] = await db.execute(
      `INSERT INTO customer_product_requests
        (customer_name, customer_phone, product_requested, qty, expected_price, notes, status, request_date, handled_by)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        d.customer_name,
        d.customer_phone,
        d.product_requested,
        d.qty,
        d.expected_price,
        d.notes,
        d.request_date,
        auth.user.id,
      ]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not save request." }, { status: 500 });
  }
}
