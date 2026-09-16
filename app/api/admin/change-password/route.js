import { NextResponse } from "next/server";
import { getSessionUser, setAdminSession } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isStaffUser } from "@/lib/roles";
import { DEFAULT_STAFF_PASSWORD, userMustChangePassword } from "@/lib/staff";
import { USER_WITH_ROLE } from "@/lib/users";

export async function POST(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }
  if (!userMustChangePassword(user)) {
    return NextResponse.json({ ok: false, message: "Password change is not required." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const newPassword = String(body.new_password || "");

  if (newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, message: "New password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (newPassword === DEFAULT_STAFF_PASSWORD) {
    return NextResponse.json(
      { ok: false, message: "Choose a personal password — not the default welcome password." },
      { status: 400 }
    );
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    await db.execute(
      "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
      [hashPassword(newPassword), user.id]
    );

    const [rows] = await db.query(`${USER_WITH_ROLE} WHERE u.id = ? LIMIT 1`, [user.id]);
    const updated = rows[0];
    if (updated) {
      await setAdminSession(updated);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update password." }, { status: 500 });
  }
}
