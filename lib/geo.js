const SHOP_LAT = 26.8872374;
const SHOP_LNG = 75.7553561;

export function shopCoords() {
  return { lat: SHOP_LAT, lng: SHOP_LNG };
}

export function distanceKm(lat, lng) {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(a - SHOP_LAT);
  const dLng = toRad(b - SHOP_LNG);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(SHOP_LAT)) * Math.cos(toRad(a)) * Math.sin(dLng / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

export function deviceFromAgent(ua) {
  const text = String(ua || "").toLowerCase();
  if (!text) return "Unknown";
  if (/ipad|tablet/.test(text)) return "Tablet";
  if (/mobi|iphone|android/.test(text)) return "Mobile";
  return "Desktop";
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "";
}
