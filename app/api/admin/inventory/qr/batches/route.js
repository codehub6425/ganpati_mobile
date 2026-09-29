import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { createQrBatch, listQrBatches } from "@/lib/inventory-qr";
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
    const batches = await listQrBatches(db);
    return NextResponse.json({ ok: true, batches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load batches." }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const prefix = String(body.prefix || "GMP").trim().toUpperCase().slice(0, 20);
  const count = Math.min(5000, Math.max(1, Math.floor(Number(body.count) || 0)));
  if (!count) {
    return NextResponse.json({ ok: false, message: "Enter batch size." }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const batch = await createQrBatch(db, auth.user.id, { prefix, count });
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not create batch." }, { status: 500 });
  }
}
