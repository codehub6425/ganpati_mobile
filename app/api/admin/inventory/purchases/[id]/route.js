import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getPurchaseById } from "@/lib/inventory-purchases";
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
  const resolved = await params;
  const id = resolved?.id;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const detail = await getPurchaseById(db, id);
    if (!detail) {
      return NextResponse.json({ ok: false, message: "Purchase not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load purchase." }, { status: 500 });
  }
}
