/** Client-safe helpers (no Node fs / DB). Used by CustomerSalePaymentPanel and server lib. */

import { parseBookDate, todayDateString } from "@/lib/ledger";

export const DUE_DATE_PRESETS = ["in_7_days", "in_15_days", "next_month_7th", "custom"];

/** @param {string} bookDateIso YYYY-MM-DD */
export function resolveDueDateFromPreset(preset, bookDateIso, customIso) {
  const base = parseBookDate(bookDateIso || todayDateString()) || todayDateString();
  const [y, m, d] = base.split("-").map(Number);
  const presetKey = String(preset || "").trim();
  if (presetKey === "custom") {
    const custom = String(customIso || "").trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(custom) ? custom : null;
  }
  if (presetKey === "in_7_days") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().slice(0, 10);
  }
  if (presetKey === "in_15_days") {
    const dt = new Date(Date.UTC(y, m - 1, d + 15));
    return dt.toISOString().slice(0, 10);
  }
  if (presetKey === "next_month_7th") {
    let nm = m;
    let ny = y;
    if (m === 12) {
      nm = 1;
      ny = y + 1;
    } else {
      nm = m + 1;
    }
    return `${ny}-${String(nm).padStart(2, "0")}-07`;
  }
  return null;
}
