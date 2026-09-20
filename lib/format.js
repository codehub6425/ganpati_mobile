/** Admin panel dates/times — India (Jaipur shop). */
export const ADMIN_TIME_ZONE = "Asia/Kolkata";
export const ADMIN_TZ_OFFSET = "+05:30";

function adminDateParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** YYYY-MM-DD in Asia/Kolkata (for “today”, day books, filters). */
export function adminTodayIso() {
  const { year, month, day } = adminDateParts(new Date());
  return `${year}-${month}-${day}`;
}

/** Normalize MySQL book_date (string or Date) to YYYY-MM-DD in Asia/Kolkata. */
export function adminBookDateIso(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const raw = value.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const { year, month, day } = adminDateParts(value);
    return `${year}-${month}-${day}`;
  }
  return null;
}

export function adminShiftIsoDays(isoDate, deltaDays) {
  const start = adminStartOfDay(isoDate);
  start.setTime(start.getTime() + deltaDays * 86400000);
  const { year, month, day } = adminDateParts(start);
  return `${year}-${month}-${day}`;
}

export function adminMonthStartIso(isoDate = adminTodayIso()) {
  const [y, m] = String(isoDate).split("-");
  return `${y}-${m}-01`;
}

export function adminStartOfDay(isoDate) {
  return new Date(`${isoDate}T00:00:00${ADMIN_TZ_OFFSET}`);
}

export function adminEndOfDay(isoDate) {
  return new Date(`${isoDate}T23:59:59.999${ADMIN_TZ_OFFSET}`);
}

export function adminCalendarAnchor(isoDate) {
  return new Date(`${isoDate}T12:00:00${ADMIN_TZ_OFFSET}`);
}

export function isAdminTodayTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const { year, month, day } = adminDateParts(date);
  return `${year}-${month}-${day}` === adminTodayIso();
}

export function adminHourNow() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ADMIN_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

export function formatAdminDateTime(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    timeZone: ADMIN_TIME_ZONE,
    ...options,
  });
}

export function formatAdminDateTimeMedium(value) {
  return formatAdminDateTime(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatAdminTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    timeZone: ADMIN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format YYYY-MM-DD or Date for display in admin. */
export function formatAdminDateFromIso(iso, options = {}) {
  if (!iso) return "";
  const anchor =
    typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ?
      adminCalendarAnchor(iso)
    : new Date(iso);
  if (Number.isNaN(anchor.getTime())) return String(iso);
  return anchor.toLocaleDateString("en-IN", {
    timeZone: ADMIN_TIME_ZONE,
    ...options,
  });
}

export function titleCase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  if (digits.length !== 10) return value ? `+91 ${value}` : "—";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function telHref(value) {
  const digits = phoneDigits(value);
  return digits ? `tel:+91${digits}` : "";
}
