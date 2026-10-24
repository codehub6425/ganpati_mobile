import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getCustomerDueDetail, patchCustomerDue } from "@/lib/customer-dues.js";
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
  const id = Math.floor(Number(resolved?.id));
  if (!id) {
    return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const detail = await getCustomerDueDetail(db, id);
    if (!detail) {
      return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    console.error("customer-due GET", error);
    return NextResponse.json({ ok: false, message: "Could not load." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const resolved = await params;
  const id = Math.floor(Number(resolved?.id));
  if (!id) {
    return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    await ensureLeadsTable();
    const db = getPool();
    const result = await patchCustomerDue(db, id, body);
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("customer-due PATCH", error);
    return NextResponse.json({ ok: false, message: "Could not update." }, { status: 500 });
  }
}
