import { getPool } from "./db.js";

export const TEMPLATE_PLACEHOLDERS = [
  "customer_name",
  "shop_name",
  "shop_phone",
  "shop_phone_line",
  "date",
  "items_block",
  "total",
  "payment_method",
  "bill_link",
];

export function formatTemplateRow(row) {
  if (!row) return null;
  let updated_at = row.updated_at;
  if (updated_at instanceof Date) {
    updated_at = updated_at.toISOString();
  } else if (updated_at != null) {
    updated_at = String(updated_at);
  }
  return {
    id: row.id,
    template_key: row.template_key,
    label: row.label,
    body: row.body,
    is_active: Boolean(Number(row.is_active)),
    updated_at,
  };
}

export async function loadMessageTemplates(db = getPool()) {
  const [rows] = await db.query(
    "SELECT * FROM message_templates ORDER BY template_key ASC"
  );
  return rows.map(formatTemplateRow);
}

export async function loadTemplateByKey(templateKey, db = getPool()) {
  const [rows] = await db.query(
    "SELECT * FROM message_templates WHERE template_key = ? AND is_active = 1 LIMIT 1",
    [templateKey]
  );
  return formatTemplateRow(rows[0]);
}

export async function saveMessageTemplate(templateKey, body, db = getPool()) {
  const key = String(templateKey || "").trim();
  const text = String(body ?? "").trim();
  if (!key) {
    return { error: "Template key is required." };
  }
  if (!text) {
    return { error: "Message body cannot be empty." };
  }
  const [existing] = await db.query(
    "SELECT id FROM message_templates WHERE template_key = ? LIMIT 1",
    [key]
  );
  if (!existing[0]) {
    return { error: "Unknown template." };
  }
  await db.execute("UPDATE message_templates SET body = ? WHERE template_key = ?", [text, key]);
  return { ok: true };
}

/** Replace {{key}} placeholders (simple, no nesting). */
export function renderTemplateBody(body, vars) {
  let out = String(body || "");
  for (const [key, value] of Object.entries(vars)) {
    const safe = value == null ? "" : String(value);
    out = out.split(`{{${key}}}`).join(safe);
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function shopNameFromEnv() {
  return String(process.env.SHOP_NAME || "Ganpati Mobile Point").trim() || "Ganpati Mobile Point";
}

export function shopPhoneFromEnv() {
  return String(process.env.SHOP_PHONE || "").replace(/\D/g, "").slice(-10);
}
