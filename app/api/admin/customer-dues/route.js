import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  createCustomerDueSale,
  getTotalCustomerDue,
  listCustomerDues,
} from "@/lib/customer-dues.js";
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const overdue = searchParams.get("overdue") === "1";

  try {
    await ensureLeadsTable();
    const db = getPool();
    const dues = await listCustomerDues(db, {
      status: status || undefined,
      overdue,
    });
    const total_due = await getTotalCustomerDue(db);
    return NextResponse.json({ ok: true, dues, total_due });
  } catch (error) {
    console.error("customer-dues GET", error);
    return NextResponse.json({ ok: false, message: "Could not load customer dues." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await createCustomerDueSale(db, auth.user, body);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("customer-dues POST", error);
    return NextResponse.json({ ok: false, message: "Could not save." }, { status: 500 });
  }
}
