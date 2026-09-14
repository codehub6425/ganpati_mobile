import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ensureLeadsTable, getPool, upsertAdminFromEnv } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { isStaffUser } from "@/lib/roles";
import { USER_WITH_ROLE } from "@/lib/users";

const COOKIE_NAME = "gmp_admin";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_MS / 1000),
    expires: new Date(Date.now() + SESSION_MS),
  };
}

function secret() {
  return process.env.SESSION_SECRET || "change-this-long-random-string";
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function encodePayload(data) {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodePayload(value) {
  try {
    return JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

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

export function createSessionToken(user) {
  const payload = encodePayload({
    id: user.id,
    exp: Date.now() + SESSION_MS,
  });
  return `${payload}.${sign(payload)}`;
}

export function applySessionCookie(store, token) {
  store.set(COOKIE_NAME, token, sessionCookieOptions());
}

export function refreshSessionToken(raw) {
  const [value, hmac] = String(raw || "").split(".");
  if (!value || !hmac || !safeEqual(hmac, sign(value))) return null;
  const data = decodePayload(value);
  const userId = Number(data?.id);
  if (!Number.isInteger(userId) || userId < 1) return null;
  if (data?.exp && Date.now() > Number(data.exp)) return null;
  return createSessionToken({ id: userId });
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
  const raw = jar.get(COOKIE_NAME)?.value || "";
  const [value, hmac] = raw.split(".");
  if (!value || !hmac || !safeEqual(hmac, sign(value))) return null;

  await ensureLeadsTable();
  const data = decodePayload(value);
  if (data?.exp && Date.now() > Number(data.exp)) return null;

  let userId = Number(data?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    if (value !== "ok" || !safeEqual(hmac, sign("ok"))) return null;
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
  const user = rows[0];
  return isStaffUser(user) ? user : null;
}

export async function isAdminLoggedIn() {
  return Boolean(await getSessionUser());
}
