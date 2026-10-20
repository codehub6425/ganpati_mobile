import { adminTodayIso, formatAdminDateFromIso } from "./format.js";
import { whatsappSendMessage } from "./whatsapp-gateway.js";
import {
  loadTemplateByKey,
  renderTemplateBody,
  shopNameFromEnv,
  shopPhoneFromEnv,
} from "./whatsapp-templates.js";
import { lineWithSerial } from "./sale-bill.js";
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
        description: lineWithSerial(row?.description ?? row?.name, row?.serial_number),
        amount: Number(row?.amount),
        made_in_date: String(row?.made_in_date || "").trim().slice(0, 10) || null,
        warranty_months: warranty_months && warranty_months > 0 ? warranty_months : null,
        warranty_until: until,
      };
    })
    .filter((row) => row.description && Number.isFinite(row.amount) && row.amount >= 0);
}

function buildItemsBlock(lines, saleDateIso) {
  return lines
    .map((row) => {
      let line = `• ${row.description} — ₹${formatMoney(row.amount)}`;
      if (row.made_in_date) {
        const madeIn = formatAdminDateFromIso(row.made_in_date, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        if (madeIn) line += ` · Made in ${madeIn}`;
      }
      if (!row.warranty_months) return line;
      const until = row.warranty_until || computeWarrantyUntil(saleDateIso, row.warranty_months);
      return line + formatWarrantyBillSuffix(row.warranty_months, until);
    })
    .join("\n");
}

/**
 * @param {{ templateKey: string, customer_phone: string, customer_name?: string, lines: Array<{description: string, amount: number|string, warranty_months?: number, warranty_until?: string}>, payment_method?: string, date?: string }} input
 */
export async function sendTemplateBill(input) {
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

  const templateKey = String(input.templateKey || "accessory_bill").trim();
  const template = await loadTemplateByKey(templateKey);
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

  const billLink = String(input.bill_link || "").trim();
  let text = renderTemplateBody(template.body, {
    customer_name: customerName,
    shop_name: shopNameFromEnv(),
    shop_phone: shopPhone ? `+91 ${shopPhone}` : "",
    shop_phone_line: shopPhone ? `Contact: +91 ${shopPhone}` : "",
    date: dateLabel,
    items_block: buildItemsBlock(lines, saleDateIso),
    total: formatMoney(total),
    payment_method: paymentMethod,
    bill_link: billLink,
  });

  if (billLink && !template.body.includes("{{bill_link}}")) {
    text = `${text}\n\nOpen or download your bill:\n${billLink}`;
  }

  return whatsappSendMessage({ to: phone, text });
}

/** @param {Parameters<typeof sendTemplateBill>[0]} input */
export async function sendAccessoryBill(input) {
  return sendTemplateBill({ ...input, templateKey: "accessory_bill" });
}

/** @param {Parameters<typeof sendTemplateBill>[0]} input */
export async function sendRepairBill(input) {
  return sendTemplateBill({ ...input, templateKey: "repair_bill" });
}
