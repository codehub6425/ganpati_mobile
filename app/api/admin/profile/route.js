import { NextResponse } from "next/server";
import { getSessionUser, setAdminSession } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isStaffUser } from "@/lib/roles";
import { USER_WITH_ROLE } from "@/lib/users";

export async function GET() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
}

export async function PATCH(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = titleCase(body.name);
  const currentPassword = String(body.current_password || "");
  const newPassword = String(body.new_password || "");

  if (!name) {
    return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
  }

  const wantsPasswordChange = newPassword.length > 0;
  if (wantsPasswordChange) {
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, message: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }
    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, message: "Enter your current password to set a new one." },
        { status: 400 }
      );
    }
  }

  try {
    await ensureLeadsTable();
    const db = getPool();

    const [rows] = await db.query(
      `${USER_WITH_ROLE}
       WHERE u.id = ? AND r.slug IN ('admin', 'staff')
       LIMIT 1`,
      [user.id]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });
    }

    if (wantsPasswordChange) {
      if (!row.password_hash || !verifyPassword(currentPassword, row.password_hash)) {
        return NextResponse.json({ ok: false, message: "Current password is incorrect." }, { status: 400 });
      }
      await db.execute(
        "UPDATE users SET name = ?, password_hash = ?, must_change_password = 0 WHERE id = ?",
        [name, hashPassword(newPassword), user.id]
      );
    } else {
      await db.execute("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);
    }

    const [updatedRows] = await db.query(`${USER_WITH_ROLE} WHERE u.id = ? LIMIT 1`, [user.id]);
    const updated = updatedRows[0];
    if (updated) {
      await setAdminSession(updated);
    }

    return NextResponse.json({
      ok: true,
      profile: {
        id: updated?.id || user.id,
        name: updated?.name || name,
        email: updated?.email || user.email,
        role: updated?.role || user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update profile." }, { status: 500 });
  }
}
