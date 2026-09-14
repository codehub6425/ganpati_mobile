import { cookies } from "next/headers";
import { ensureLeadsTable, getPool, upsertAdminFromEnv } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { isStaffUser } from "@/lib/roles";
import {
  applySessionCookie,
  COOKIE_NAME,
  createSessionToken,
  readSessionPayload,
  sessionCookieOptions,
} from "@/lib/session";
import { USER_WITH_ROLE } from "@/lib/users";

export { applySessionCookie, createSessionToken } from "@/lib/session";

export async function findStaffByEmail(email) {
  await ensureLeadsTable();
  const [rows] = await getPool().query(
    `${USER_WITH_ROLE}
     WHERE u.email = ? AND r.slug IN ('admin', 'staff')
     LIMIT 1`,
    [String(email || "").trim().toLowerCase()]
  );
  return rows[0] || null;
}

export async function loginWithPassword(email, password) {
  const user = await findStaffByEmail(email);
  if (user && isStaffUser(user) && verifyPassword(password, user.password_hash)) {
    return user;
  }

  const envEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const envPassword = String(process.env.ADMIN_PASSWORD || "");
  const givenEmail = String(email || "").trim().toLowerCase();
  if (!envEmail || !envPassword || givenEmail !== envEmail || String(password) !== envPassword) {
    return null;
  }

  const restored = await upsertAdminFromEnv();
  return isStaffUser(restored) ? restored : null;
}

export async function setAdminSession(user) {
  const token = createSessionToken(user);
  const jar = await cookies();
  applySessionCookie(jar, token);
  return token;
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSessionUser() {
  const jar = await cookies();
  const session = readSessionPayload(jar.get(COOKIE_NAME)?.value || "");
  if (!session) return null;

  await ensureLeadsTable();
  const userId = Number(session.data?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    if (session.value !== "ok") return null;
    const [admins] = await getPool().query(
      `${USER_WITH_ROLE}
       WHERE r.slug = 'admin' AND u.status = 'active'
       LIMIT 1`
    );
    return isStaffUser(admins[0]) ? admins[0] : null;
  }

  const [rows] = await getPool().query(
    `${USER_WITH_ROLE}
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return isStaffUser(rows[0]) ? rows[0] : null;
}

export async function isAdminLoggedIn() {
  return Boolean(await getSessionUser());
}
