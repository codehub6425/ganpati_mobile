import { formatAdminDateFromIso } from "./format.js";

export const WARRANTY_MONTH_CHOICES = [3, 6, 12, 24, 36];

/** Dropdown label, e.g. "3 months", "1 month". */
export function formatWarrantyMonthChoiceLabel(months) {
  const n = Math.floor(Number(months));
  if (!Number.isFinite(n) || n < 1) return "";
  return n === 1 ? "1 month" : `${n} months`;
}

/** Add calendar months to YYYY-MM-DD (sale date). */
export function adminAddMonthsToIso(isoDate, monthCount) {
  const raw = String(isoDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const months = Math.floor(Number(monthCount));
  if (!Number.isFinite(months) || months < 1) return null;

  let y = Number(raw.slice(0, 4));
  let mo = Number(raw.slice(5, 7)) - 1;
  let day = Number(raw.slice(8, 10));

  mo += months;
  y += Math.floor(mo / 12);
  mo = ((mo % 12) + 12) % 12;

  const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  day = Math.min(day, lastDay);

  return `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function computeWarrantyUntil(saleDateIso, monthCount) {
  return adminAddMonthsToIso(saleDateIso, monthCount);
}

export function formatWarrantyUntilLabel(untilIso) {
  if (!untilIso) return "";
  return formatAdminDateFromIso(untilIso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Text suffix for bill line items, e.g. " · Warranty 24 mo (valid till 18 Oct 2028)" */
export function formatWarrantyBillSuffix(months, untilIso) {
  const m = Number(months);
  if (!Number.isFinite(m) || m < 1 || !untilIso) return "";
  const till = formatWarrantyUntilLabel(untilIso);
  return ` · Warranty ${m} mo (valid till ${till})`;
}
