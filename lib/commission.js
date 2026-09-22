export const COMMISSION_CALC_TYPES = ["percent", "fixed", "slab"];
export const COMMISSION_BASE_FIELDS = ["amount", "transfer_amount"];

export function resolveRuleKey(category, mtSubtype) {
  const cat = String(category || "").trim();
  const sub = String(mtSubtype || "mt").trim().toLowerCase();
  if (cat === "recharge") return "recharge";
  if (cat === "money_transfer") {
    if (sub === "redem") return "money_transfer_redem";
    if (sub === "mt") return "money_transfer_mt";
    if (sub === "aps") return "money_transfer_aps";
  }
  return null;
}

export function commissionEligible(category, mtSubtype) {
  return Boolean(resolveRuleKey(category, mtSubtype));
}

export function commissionBaseAmount(entry, rule) {
  const amount = Number(entry?.amount);
  const transfer = entry?.transfer_amount != null ? Number(entry.transfer_amount) : NaN;
  const baseField = rule?.base_field || "amount";

  if (baseField === "transfer_amount") {
    if (Number.isFinite(transfer) && transfer > 0) return transfer;
    return Number.isFinite(amount) ? amount : 0;
  }
  return Number.isFinite(amount) ? amount : 0;
}

export function calculateCommission(rule, baseAmount) {
  if (!rule || !rule.is_active) return 0;
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base < 0) return 0;

  const calcType = String(rule.calc_type || "percent").toLowerCase();
  let value = 0;

  if (calcType === "percent") {
    const rate = Number(rule.rate);
    if (!Number.isFinite(rate) || rate < 0) return 0;
    // Shop profit in whole rupees (2.5% of ₹349 → ₹9, not deducted from ₹349).
    value = Math.round((base * rate) / 100);
  } else if (calcType === "fixed") {
    const rate = Number(rule.rate);
    if (!Number.isFinite(rate) || rate < 0) return 0;
    value = rate;
  } else if (calcType === "slab") {
    const slabBase = Number(rule.slab_base);
    const slabValue = Number(rule.slab_value);
    if (!Number.isFinite(slabBase) || slabBase <= 0 || !Number.isFinite(slabValue) || slabValue < 0) {
      return 0;
    }
    if (base <= 0) return 0;
    // Tiered slabs: ₹0–1000 → ₹10, ₹1000–2000 → ₹20 (each part of slab counts as one step).
    value = Math.ceil(base / slabBase) * slabValue;
  }

  return Math.round(value * 100) / 100;
}

export function findRuleForEntry(rules, entry) {
  const key = resolveRuleKey(entry?.category, entry?.mt_subtype);
  if (!key) return null;
  return (rules || []).find((r) => r.rule_key === key && r.is_active) || null;
}

export function suggestCommission(rules, entry) {
  const rule = findRuleForEntry(rules, entry);
  if (!rule) return 0;
  const base = commissionBaseAmount(entry, rule);
  return calculateCommission(rule, base);
}

export function formatRuleRow(row) {
  return {
    id: row.id,
    rule_key: row.rule_key,
    label: row.label,
    calc_type: row.calc_type,
    rate: row.rate != null ? Number(row.rate) : null,
    slab_base: row.slab_base != null ? Number(row.slab_base) : null,
    slab_value: row.slab_value != null ? Number(row.slab_value) : null,
    base_field: row.base_field || "amount",
    is_active: Boolean(row.is_active),
    updated_at: row.updated_at,
  };
}

export async function loadCommissionRules(db) {
  const [rows] = await db.query("SELECT * FROM commission_rules ORDER BY id ASC");
  return rows.map(formatRuleRow);
}

export function resolveCommissionForSave(rules, entry, clientAmount, commissionManual) {
  const rule = findRuleForEntry(rules, entry);
  if (!rule) {
    return { commission_amount: null, commission_manual: false };
  }

  const base = commissionBaseAmount(entry, rule);
  const auto = calculateCommission(rule, base);

  if (commissionManual) {
    let manual = Number(clientAmount);
    if (!Number.isFinite(manual) || manual < 0) manual = 0;
    manual = Math.round(manual * 100) / 100;
    return {
      commission_amount: manual,
      commission_manual: true,
    };
  }

  return { commission_amount: auto, commission_manual: false };
}
