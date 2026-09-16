export const LEDGER_CATEGORIES = [
  "recharge",
  "money_transfer",
  "accessory",
  "repair",
  "payment",
];

export const MT_SUBTYPES = ["mt", "redem", "aps"];

export const RECHARGE_PROVIDERS = ["Jio", "Airtel", "Airtel TV", "Vi", "BSNL", "Other"];

export const PAYMENT_METHODS = ["cash", "upi", "sbi", "boi", "other"];

export const CATEGORY_LABELS = {
  recharge: "Recharge",
  money_transfer: "M/T",
  accessory: "Acc.",
  repair: "Repair",
  payment: "Payment",
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function normalizeCustomerPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(-10);
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseBookDate(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

export function isToday(dateStr) {
  return dateStr === todayDateString();
}

export function canEditDayBook(user, bookDate) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "staff") return isToday(bookDate);
  return false;
}

export function normalizeEntryInput(body) {
  const category = String(body.category || "").trim();
  if (!LEDGER_CATEGORIES.includes(category)) {
    return { error: "Invalid category." };
  }

  const amount = num(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Enter a valid amount." };
  }

  const description = String(body.description || "").trim().slice(0, 200);
  const provider = String(body.provider || "").trim().slice(0, 40) || null;
  const payment_method = String(body.payment_method || "").trim().toLowerCase() || null;
  const mt_subtype = String(body.mt_subtype || "mt").trim().toLowerCase();
  const transfer_amount = body.transfer_amount != null && body.transfer_amount !== ""
    ? num(body.transfer_amount)
    : null;

  let lead_id = body.lead_id != null && body.lead_id !== "" ? Number(body.lead_id) : null;
  if (lead_id != null && (!Number.isInteger(lead_id) || lead_id < 1)) lead_id = null;

  let customer_phone = null;
  const rawPhone = String(body.customer_phone ?? "").trim();
  if (rawPhone) {
    customer_phone = normalizeCustomerPhone(rawPhone);
    if (!customer_phone) {
      return { error: "Enter a valid 10-digit mobile or leave blank." };
    }
  }

  if (category === "recharge" && !provider) {
    return { error: "Select a recharge provider." };
  }
  if (category === "money_transfer") {
    if (!MT_SUBTYPES.includes(mt_subtype)) {
      return { error: "Invalid M/T type." };
    }
    if (transfer_amount != null && (!Number.isFinite(transfer_amount) || transfer_amount < 0)) {
      return { error: "Enter a valid transfer amount." };
    }
  }
  if (category === "accessory" && !description) {
    return { error: "Add a short description for Acc." };
  }
  const device_brand_raw = String(body.device_brand || "").trim().slice(0, 40);
  const device_brand = category === "repair" ? device_brand_raw || null : null;

  if (category === "repair" && !device_brand) {
    return { error: "Select mobile brand (or enter under Other)." };
  }
  if (category === "repair" && !description) {
    return { error: "Add repair details (e.g. combo, screen)." };
  }
  if (category === "payment" && !description) {
    return { error: "Add what this payment was for." };
  }
  if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    return { error: "Invalid payment method." };
  }

  return {
    entry: {
      category,
      amount,
      transfer_amount: category === "money_transfer" ? transfer_amount : null,
      mt_subtype: category === "money_transfer" ? mt_subtype : null,
      provider: category === "recharge" ? provider : null,
      description: description || null,
      payment_method: category === "accessory" ? payment_method : null,
      lead_id: category === "repair" ? lead_id : null,
      customer_phone:
        category === "recharge" || category === "money_transfer" ? customer_phone : null,
      device_brand,
    },
  };
}

export function computeTotals(entries) {
  const totals = {
    total_recharge: 0,
    total_mt: 0,
    total_accessory: 0,
    total_repair: 0,
    total_payment: 0,
  };

  for (const row of entries) {
    const amt = Number(row.amount) || 0;
    switch (row.category) {
      case "recharge":
        totals.total_recharge += amt;
        break;
      case "money_transfer":
        totals.total_mt += amt;
        break;
      case "accessory":
        totals.total_accessory += amt;
        break;
      case "repair":
        totals.total_repair += amt;
        break;
      case "payment":
        totals.total_payment += amt;
        break;
      default:
        break;
    }
  }

  totals.net_inflow =
    totals.total_recharge +
    totals.total_mt +
    totals.total_accessory +
    totals.total_repair;
  totals.net_day = totals.net_inflow - totals.total_payment;

  return totals;
}

export function formatEntryRow(row) {
  const bookDate = row.book_date;
  const book_date =
    bookDate ?
      typeof bookDate === "string" ?
        bookDate.slice(0, 10)
      : bookDate.toISOString?.().slice(0, 10) || String(bookDate).slice(0, 10)
    : null;

  return {
    id: row.id,
    book_date,
    category: row.category,
    amount: Number(row.amount),
    transfer_amount: row.transfer_amount != null ? Number(row.transfer_amount) : null,
    mt_subtype: row.mt_subtype,
    provider: row.provider,
    description: row.description,
    payment_method: row.payment_method,
    lead_id: row.lead_id,
    lead_name: row.lead_name || null,
    lead_phone: row.lead_phone || null,
    customer_phone: row.customer_phone || null,
    device_brand: row.device_brand || null,
    created_at: row.created_at,
    created_by_name: row.created_by_name || null,
  };
}
