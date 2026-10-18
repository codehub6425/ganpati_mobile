import { adminTodayIso, formatAdminDateFromIso } from "./format.js";
import { whatsappSendMessage } from "./whatsapp-gateway.js";
import {
  loadTemplateByKey,
  renderTemplateBody,
  shopNameFromEnv,
  shopPhoneFromEnv,
} from "./whatsapp-templates.js";
import { computeWarrantyUntil, formatWarrantyBillSuffix } from "./warranty.js";

function formatMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function normalizeLines(lines, saleDateIso) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((row) => {
      const warranty_months =
        row.warranty_months != null && row.warranty_months !== "" ?
          Math.floor(Number(row.warranty_months))
        : null;
      const until =
        row.warranty_until ||
        (warranty_months ? computeWarrantyUntil(saleDateIso, warranty_months) : null);
      return {
        description: String(row?.description ?? row?.name ?? "").trim(),
        amount: Number(row?.amount),
        warranty_months: warranty_months && warranty_months > 0 ? warranty_months : null,
        warranty_until: until,
      };
    })
    .filter((row) => row.description && Number.isFinite(row.amount) && row.amount >= 0);
}

function buildItemsBlock(lines, saleDateIso) {
  return lines
    .map((row) => {
      const base = `• ${row.description} — ₹${formatMoney(row.amount)}`;
      if (!row.warranty_months) return base;
      const until = row.warranty_until || computeWarrantyUntil(saleDateIso, row.warranty_months);
      return base + formatWarrantyBillSuffix(row.warranty_months, until);
    })
    .join("\n");
}

/**
 * @param {{ customer_phone: string, customer_name?: string, lines: Array<{description: string, amount: number|string, warranty_months?: number, warranty_until?: string}>, payment_method?: string, date?: string }} input
 */
export async function sendAccessoryBill(input) {
  const phone = String(input.customer_phone || "").replace(/\D/g, "");
  if (phone.length !== 10) {
    return { ok: false, error: "Invalid customer phone." };
  }

  const dateIso = String(input.date || "").slice(0, 10);
  const saleDateIso =
    dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : adminTodayIso();

  const lines = normalizeLines(input.lines, saleDateIso);
  if (lines.length === 0) {
    return { ok: false, error: "No bill items." };
  }

  const template = await loadTemplateByKey("accessory_bill");
  if (!template?.body) {
    return { ok: false, error: "Bill template is missing." };
  }

  const total = lines.reduce((sum, row) => sum + row.amount, 0);
  const dateLabel = formatAdminDateFromIso(saleDateIso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const shopPhone = shopPhoneFromEnv();
  const customerName = String(input.customer_name || "").trim() || "Customer";
  const paymentMethod =
    String(input.payment_method || "").trim() ?
      String(input.payment_method).toUpperCase()
    : "CASH";

  const text = renderTemplateBody(template.body, {
    customer_name: customerName,
    shop_name: shopNameFromEnv(),
    shop_phone: shopPhone ? `+91 ${shopPhone}` : "",
    shop_phone_line: shopPhone ? `Contact: +91 ${shopPhone}` : "",
    date: dateLabel,
    items_block: buildItemsBlock(lines, saleDateIso),
    total: formatMoney(total),
    payment_method: paymentMethod,
  });

  return whatsappSendMessage({ to: phone, text });
}
