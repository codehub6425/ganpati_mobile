import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { loadSaleById } from "@/lib/inventory";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    const sale = await loadSaleById(db, id);
    if (!sale) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, sale });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load sale." }, { status: 500 });
  }
}
