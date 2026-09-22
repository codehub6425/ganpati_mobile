import { commissionEligible } from "@/lib/commission";
import { adminBookDateIso, adminTodayIso, titleCase } from "@/lib/format";

/** Customer-facing transaction amount (recharge/M/T face value, sale amount, etc.). */
export function entryTxnAmount(entry) {
  return Number(entry?.amount) || 0;
}

/** Cash from customer (recharge/M/T face value, sale amount, etc.) — commission is separate profit. */
export function entryCollectionAmount(entry) {
  return entryTxnAmount(entry);
}

/** M/T impact on total collection: APS debits full amount; M/T & Redeem add full amount. */
export function entryMtCollectionGross(entry) {
  const amount = entryTxnAmount(entry);
  if (entry?.category !== "money_transfer") return amount;
  const sub = String(entry?.mt_subtype || "").trim().toLowerCase();
  if (sub === "aps") {
    return amount > 0 ? -amount : 0;
  }
  return amount;
}

export function isApsEntry(entry) {
  return (
    entry?.category === "money_transfer" && String(entry?.mt_subtype || "").trim().toLowerCase() === "aps"
  );
}

/** Amount counted as shop revenue on summaries (commission for recharge/M/T, else entry amount). */
export function entryRevenueAmount(entry) {
  const amount = Number(entry?.amount) || 0;
  if (commissionEligible(entry?.category, entry?.mt_subtype)) {
    const comm = entry?.commission_amount != null ? Number(entry.commission_amount) : NaN;
    return Number.isFinite(comm) && comm >= 0 ? comm : 0;
  }
  if (entry?.category === "payment") return amount;
  return amount;
}

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

/** Payment given = money out (debit). Payment taken = money in (credit). */
export const PAYMENT_FLOWS = ["given", "taken"];

export const PAYMENT_FLOW_LABELS = {
  given: "Debit — Money Out",
  taken: "Credit — Money In",
};

export const DEFAULT_PAYMENT_TAKEN_ITEMS = ["Room rent", "Interest", "Due amount"];

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
  return adminTodayIso();
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
  const date = adminBookDateIso(bookDate) || String(bookDate || "").trim().slice(0, 10);
  if (!date) return false;
  if (user.role === "admin") return true;
  if (user.role === "staff") return date === todayDateString();
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
  const mt_subtype = String(body.mt_subtype || "").trim().toLowerCase();
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
    if (!mt_subtype || !MT_SUBTYPES.includes(mt_subtype)) {
      return { error: "Select type: M/T, Redeem, or APS." };
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
  let payment_flow = null;
  if (category === "payment") {
    payment_flow = String(body.payment_flow || "given").trim().toLowerCase();
    if (!PAYMENT_FLOWS.includes(payment_flow)) {
      return { error: "Select Credit (money in) or Debit (money out)." };
    }
    if (!description) {
      return {
        error:
          payment_flow === "taken" ?
            "Add what was received (e.g. room rent, interest)."
          : "Add what this payment was for.",
      };
    }
  }
  if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    return { error: "Invalid payment method." };
  }

  const commission_manual = Boolean(body.commission_manual);
  let commission_amount_input = null;
  if (body.commission_amount != null && body.commission_amount !== "") {
    const c = num(body.commission_amount);
    if (Number.isFinite(c) && c >= 0) commission_amount_input = c;
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
        category === "recharge" ||
        category === "money_transfer" ||
        category === "accessory" ||
        category === "repair" ?
          customer_phone
        : null,
      device_brand,
      payment_flow: category === "payment" ? payment_flow : null,
    },
    commission_manual,
    commission_amount_input,
  };
}

export function computeTotals(entries) {
  const totals = {
    total_recharge: 0,
    total_mt: 0,
    total_accessory: 0,
    total_repair: 0,
    total_payment: 0,
    total_payment_taken: 0,
    total_commission: 0,
    total_recharge_gross: 0,
    total_mt_gross: 0,
  };

  for (const row of entries) {
    const amt = Number(row.amount) || 0;
    const comm = row.commission_amount != null ? Number(row.commission_amount) : NaN;
    const commission = Number.isFinite(comm) && comm > 0 ? comm : 0;
    if (commission > 0) {
      totals.total_commission += commission;
    }

    switch (row.category) {
      case "recharge":
        totals.total_recharge_gross += amt;
        totals.total_recharge += entryRevenueAmount(row);
        break;
      case "money_transfer":
        totals.total_mt_gross += entryMtCollectionGross(row);
        totals.total_mt += entryRevenueAmount(row);
        break;
      case "accessory":
        totals.total_accessory += amt;
        break;
      case "repair":
        totals.total_repair += amt;
        break;
      case "payment":
        if (row.payment_flow === "taken") {
          totals.total_payment_taken += amt;
        } else {
          totals.total_payment += amt;
        }
        break;
      default:
        break;
    }
  }

  totals.total_recharge = Math.round(totals.total_recharge * 100) / 100;
  totals.total_mt = Math.round(totals.total_mt * 100) / 100;
  totals.total_commission = Math.round(totals.total_commission * 100) / 100;

  totals.net_inflow =
    totals.total_recharge +
    totals.total_mt +
    totals.total_accessory +
    totals.total_repair;
  totals.net_day = totals.net_inflow - totals.total_payment + totals.total_payment_taken;
  totals.net_day = Math.round(totals.net_day * 100) / 100;

  /** Money from customers (recharge/M/T face value + sales + payment in). Profit is not added again. */
  totals.total_collection =
    totals.total_recharge_gross +
    totals.total_mt_gross +
    totals.total_accessory +
    totals.total_repair +
    totals.total_payment_taken;
  totals.total_collection = Math.round(totals.total_collection * 100) / 100;

  return totals;
}

/** Category card main = customer / txn total (commission types use gross only). */
export function categoryCollectionTotal(totals, category) {
  if (!totals) return 0;
  switch (category) {
    case "recharge":
      return totals.total_recharge_gross ?? 0;
    case "money_transfer":
      return totals.total_mt_gross ?? 0;
    case "accessory":
      return totals.total_accessory ?? 0;
    case "repair":
      return totals.total_repair ?? 0;
    default:
      return 0;
  }
}

export function formatEntryRow(row) {
  const book_date = adminBookDateIso(row.book_date);

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
    customer_name: row.customer_name ? titleCase(row.customer_name) : null,
    device_brand: row.device_brand || null,
    payment_flow: row.payment_flow || (row.category === "payment" ? "given" : null),
    commission_amount:
      row.commission_amount != null ? Number(row.commission_amount) : null,
    commission_manual: Boolean(row.commission_manual),
    created_at: row.created_at,
    created_by_name: row.created_by_name || null,
  };
}
