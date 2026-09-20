import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { normalizeCustomerPhone } from "@/lib/ledger";
import { canManageUsers } from "@/lib/roles";
import { USER_WITH_ROLE } from "@/lib/users";

const ALLOWED = new Set(["active", "suspended"]);

function nextStaffProfile(body, target) {
  const nextName = Object.prototype.hasOwnProperty.call(body, "name") ?
      titleCase(body.name)
    : target.name;

  let nextEmail = target.email ?? null;
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const raw = String(body.email || "").trim().toLowerCase();
    nextEmail = raw || null;
  }

  let nextPhone = target.phone ?? null;
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    const phoneRaw = body.phone;
    if (phoneRaw === null || String(phoneRaw).trim() === "") {
      nextPhone = null;
    } else {
      nextPhone = normalizeCustomerPhone(phoneRaw);
    }
  }

  return { nextName, nextEmail, nextPhone };
}

function validateStaffProfile({ nextName, nextEmail, nextPhone }) {
  if (!String(nextName || "").trim()) {
    return "Name is required.";
  }
  if (!nextEmail && !nextPhone) {
    return "Enter mobile number (or email if no mobile).";
  }
  if (nextEmail && !nextEmail.includes("@")) {
    return "Enter a valid email address.";
  }
  return null;
}

function bodyPhoneProvided(body) {
  return (
    Object.prototype.hasOwnProperty.call(body, "phone") &&
    body.phone !== null &&
    String(body.phone).trim() !== ""
  );
}

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
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
  const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
  const hasProfile = hasName || hasEmail || hasPhone;

  if (!hasStatus && !hasProfile) {
    return NextResponse.json({ ok: false, message: "Nothing to update." }, { status: 400 });
  }

  if (hasStatus) {
    const status = String(body.status || "").trim().toLowerCase();
    if (!ALLOWED.has(status)) {
      return NextResponse.json({ ok: false, message: "Status must be active or suspended." }, { status: 400 });
    }
    if (userId === actor.id && status === "suspended") {
      return NextResponse.json({ ok: false, message: "You cannot suspend your own account." }, { status: 400 });
    }
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

    if (hasProfile) {
      const profile = nextStaffProfile(body, target);
      if (hasPhone && bodyPhoneProvided(body) && !profile.nextPhone) {
        return NextResponse.json(
          { ok: false, message: "Enter a valid 10-digit mobile number." },
          { status: 400 }
        );
      }
      const profileError = validateStaffProfile(profile);
      if (profileError) {
        return NextResponse.json({ ok: false, message: profileError }, { status: 400 });
      }

      if (profile.nextEmail) {
        const [dupEmail] = await db.query("SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", [
          profile.nextEmail,
          userId,
        ]);
        if (dupEmail[0]) {
          return NextResponse.json({ ok: false, message: "That email is already in use." }, { status: 409 });
        }
      }
      if (profile.nextPhone) {
        const [dupPhone] = await db.query("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1", [
          profile.nextPhone,
          userId,
        ]);
        if (dupPhone[0]) {
          return NextResponse.json(
            { ok: false, message: "That mobile number is already in use." },
            { status: 409 }
          );
        }
      }

      await db.execute("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?", [
        profile.nextName,
        profile.nextEmail,
        profile.nextPhone,
        userId,
      ]);
    }

    if (hasStatus) {
      await db.execute("UPDATE users SET status = ? WHERE id = ?", [
        String(body.status).trim().toLowerCase(),
        userId,
      ]);
    }

    const refreshed = hasProfile ? nextStaffProfile(body, target) : null;

    return NextResponse.json({
      ok: true,
      ...(hasStatus ? { status: String(body.status).trim().toLowerCase() } : {}),
      ...(refreshed ?
        { name: refreshed.nextName, email: refreshed.nextEmail, phone: refreshed.nextPhone }
      : {}),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const msg =
        String(error.message || "").includes("unique_phone") ?
          "That mobile number is already in use."
        : "That email is already in use.";
      return NextResponse.json({ ok: false, message: msg }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update staff." }, { status: 500 });
  }
}
