export function getSiteOrigin(fallbackOrigin = "") {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || fallbackOrigin || "";
  return String(raw).replace(/\/$/, "");
}
