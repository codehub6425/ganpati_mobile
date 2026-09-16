import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "gmp_admin";

/** Default 30 days — override with SESSION_DAYS env (1–365). */
export const SESSION_DAYS = Math.min(
  365,
  Math.max(1, Number.parseInt(process.env.SESSION_DAYS || "30", 10) || 30)
);
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

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

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_MS / 1000),
  };
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

export function readSessionPayload(raw) {
  const [value, hmac] = String(raw || "").split(".");
  if (!value || !hmac || !safeEqual(hmac, sign(value))) return null;
  const data = decodePayload(value);
  if (!data) return null;
  if (data.exp && Date.now() > Number(data.exp)) return null;
  return { value, hmac, data };
}

export function refreshSessionToken(raw) {
  const session = readSessionPayload(raw);
  const userId = Number(session?.data?.id);
  if (!Number.isInteger(userId) || userId < 1) return null;
  return createSessionToken({ id: userId });
}
