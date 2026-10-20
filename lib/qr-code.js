import { getBasePath } from "@/lib/basePath";

const PAD = 6;

export function formatQrCode(prefix, num) {
  const p = String(prefix || "GMP")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  const n = Math.max(1, Math.floor(Number(num) || 0));
  return `${p}-${String(n).padStart(PAD, "0")}`;
}

export function extractQrCodeFromPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const fromQuery = new URL(text).searchParams.get("code");
    if (fromQuery) return fromQuery;
  } catch {
    const match = text.match(/[?&]code=([^&#]+)/i);
    if (match) {
      try {
        return decodeURIComponent(match[1].replace(/\+/g, " "));
      } catch {
        return match[1];
      }
    }
  }
  return text;
}

export function normalizeQrCode(raw) {
  return extractQrCodeFromPayload(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function buildQrScanUrl(code, origin) {
  const formatted = normalizeQrCode(code);
  if (!formatted) return "";
  const path = `${getBasePath()}/admin/inventory/scan?code=${encodeURIComponent(formatted)}`;
  if (!origin) return path;
  return `${String(origin).replace(/\/$/, "")}${path}`;
}

export function originFromRequest(request) {
  try {
    const url = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
    if (!host) return "";
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}
