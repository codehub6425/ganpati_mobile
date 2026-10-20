import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { deleteQrUnit, listQrUnits } from "@/lib/inventory-qr";
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
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await listQrUnits(db, {
      status: params.get("status"),
      product_id: params.get("product_id"),
      search: params.get("search"),
      limit: params.get("limit"),
      offset: params.get("offset"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load QR units." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const body = await request.json().catch(() => ({}));
  const code = params.get("code") || body.code;
  if (!code) {
    return NextResponse.json({ ok: false, message: "QR code is required." }, { status: 400 });
  }
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await deleteQrUnit(db, code);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, code: result.code });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not delete QR code." }, { status: 500 });
  }
}
