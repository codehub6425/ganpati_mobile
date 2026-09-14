import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool, getRoleId } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { hashPassword } from "@/lib/password";
import { canManageUsers } from "@/lib/roles";
import { USER_WITH_ROLE } from "@/lib/users";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const role = new URL(request.url).searchParams.get("role") || "customer";
  if (role === "staff" && !canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can view staff." }, { status: 403 });
  }
  await ensureLeadsTable();
  const allowed = role === "staff" ? "staff" : "customer";
  const [rows] = await getPool().query(
    `${USER_WITH_ROLE}
     WHERE r.slug = ?
     ORDER BY u.created_at DESC`,
    [allowed]
  );
  return NextResponse.json({ ok: true, users: rows });
}

export async function POST(request) {
  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }
  if (!canManageUsers(actor)) {
    return NextResponse.json({ ok: false, message: "Only an admin can add users." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = titleCase(body.name);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const role = String(body.role || "staff").toLowerCase();

  if (!name) {
    return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, message: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, message: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (role !== "staff") {
    return NextResponse.json({ ok: false, message: "Only staff can be added here." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const staffRoleId = await getRoleId(getPool(), "staff");
    if (!staffRoleId) {
      return NextResponse.json({ ok: false, message: "Staff role is missing." }, { status: 500 });
    }
    await getPool().execute(
      `INSERT INTO users (name, email, phone, password_hash, role_id, status)
       VALUES (?, ?, NULL, ?, ?, 'active')`,
      [name, email, hashPassword(password), staffRoleId]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ ok: false, message: "That email is already in use." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not add this user." }, { status: 500 });
  }
}
