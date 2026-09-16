/** Edge-safe session helpers (middleware). Must match lib/session.js tokens. */

export const COOKIE_NAME = "gmp_admin";

const SESSION_DAYS = Math.min(
  365,
  Math.max(1, Number.parseInt(process.env.SESSION_DAYS || "30", 10) || 30)
);
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.SESSION_SECRET || "change-this-long-random-string";
}

function encodePayload(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(value) {
  try {
    let b64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function sign(value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return out === 0;
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

async function readSessionPayload(raw) {
  const [value, hmac] = String(raw || "").split(".");
  if (!value || !hmac) return null;
  const expected = await sign(value);
  if (!safeEqual(hmac, expected)) return null;
  const data = decodePayload(value);
  if (!data) return null;
  if (data.exp && Date.now() > Number(data.exp)) return null;
  return { value, hmac, data };
}

async function createSessionToken(user) {
  const payload = encodePayload({
    id: user.id,
    exp: Date.now() + SESSION_MS,
  });
  return `${payload}.${await sign(payload)}`;
}

/** Sliding refresh: new token + 30-day cookie maxAge on each admin visit/API call. */
export async function refreshSessionToken(raw) {
  const session = await readSessionPayload(raw);
  const userId = Number(session?.data?.id);
  if (!Number.isInteger(userId) || userId < 1) return null;
  return await createSessionToken({ id: userId });
}
