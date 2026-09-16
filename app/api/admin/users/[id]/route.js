import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";
import { USER_WITH_ROLE } from "@/lib/users";

const ALLOWED = new Set(["active", "suspended"]);

export async function PATCH(request, { params }) {
  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }
  if (!canManageUsers(actor)) {
    return NextResponse.json({ ok: false, message: "Only an admin can update staff." }, { status: 403 });
  }

  const userId = Number((await params).id);
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ ok: false, message: "Invalid user." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "").trim().toLowerCase();
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ ok: false, message: "Status must be active or suspended." }, { status: 400 });
  }

  if (userId === actor.id && status === "suspended") {
    return NextResponse.json({ ok: false, message: "You cannot suspend your own account." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query(
      `${USER_WITH_ROLE}
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    );
    const target = rows[0];
    if (!target) {
      return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
    }
    if (target.role !== "staff") {
      return NextResponse.json({ ok: false, message: "Only staff accounts can be updated here." }, { status: 400 });
    }

    await db.execute("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update staff status." }, { status: 500 });
  }
}
