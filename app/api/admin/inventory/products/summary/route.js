import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getProductListSummary } from "@/lib/inventory";
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
    const summary = await getProductListSummary(db);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load summary." }, { status: 500 });
  }
}
