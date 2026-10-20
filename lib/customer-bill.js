import crypto from "crypto";
import { getPool } from "./db.js";
import { getBasePath } from "./basePath.js";
import { originFromRequest } from "./qr-code.js";
import { normalizeInvoiceNo } from "./sale-bill.js";

export const CREATE_CUSTOMER_BILLS = `
  CREATE TABLE IF NOT EXISTS customer_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(40) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    invoice_no VARCHAR(20) NULL,
    customer_phone VARCHAR(10) NULL,
    customer_name VARCHAR(80) NULL,
    payment_method VARCHAR(20) NULL,
    sale_date DATE NULL,
    payload JSON NOT NULL,
    ledger_entry_ids JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_token (token),
    KEY invoice_idx (invoice_no),
    KEY phone_idx (customer_phone)
  )
`;

export async function ensureCustomerBillsTable(db = getPool()) {
  await db.query(CREATE_CUSTOMER_BILLS);
}

export function newBillToken() {
  return crypto.randomBytes(16).toString("base64url");
}

export function normalizeBillToken(raw) {
  return String(raw || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 40);
}

export function buildCustomerBillUrl(token, origin) {
  const safe = normalizeBillToken(token);
  if (!safe) return "";
  const path = `${getBasePath()}/bill/${encodeURIComponent(safe)}`;
  if (!origin) return path;
  return `${String(origin).replace(/\/$/, "")}${path}`;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function publicBillFromRow(row) {
  if (!row) return null;
  const payload = parseJsonField(row.payload, {}) || {};
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return {
    kind: payload.kind || row.kind || "accessory",
    invoiceNo: payload.invoiceNo || row.invoice_no || "",
    date: payload.date || (row.sale_date ? String(row.sale_date).slice(0, 10) : ""),
    time: payload.time || "",
    customer_name: payload.customer_name || row.customer_name || "",
    customer_phone: payload.customer_phone || row.customer_phone || "",
    payment_method: payload.payment_method || row.payment_method || "cash",
    cashier: payload.cashier || "",
    lines,
  };
}

function saleBillPayloadFromSendInput(input, kind) {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  return {
    kind,
    invoiceNo: normalizeInvoiceNo(input.invoice_no) || "",
    date: String(input.date || "").slice(0, 10),
    time: "",
    customer_name: String(input.customer_name || "").trim(),
    customer_phone: String(input.customer_phone || "").replace(/\D/g, "").slice(-10),
    payment_method: String(input.payment_method || "cash").trim() || "cash",
    cashier: "",
    lines: lines.map((row) => ({
      description: String(row?.description || row?.name || "Item").trim(),
      amount: Number(row?.amount) || 0,
      serial_number: String(row?.serial_number || "").trim(),
      made_in_date: String(row?.made_in_date || "").trim().slice(0, 10),
      warranty_months: row?.warranty_months || null,
      warranty_until: row?.warranty_until || null,
    })),
  };
}

export async function createCustomerBill(input, db = getPool()) {
  await ensureCustomerBillsTable(db);
  const token = newBillToken();
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const saleDate = String(input.date || payload.date || "").slice(0, 10);
  await db.execute(
    `INSERT INTO customer_bills
      (token, kind, invoice_no, customer_phone, customer_name, payment_method, sale_date, payload, ledger_entry_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      token,
      String(input.kind || payload.kind || "accessory").slice(0, 20),
      normalizeInvoiceNo(input.invoice_no || payload.invoiceNo) || null,
      String(input.customer_phone || payload.customer_phone || "").replace(/\D/g, "").slice(-10) ||
        null,
      String(input.customer_name || payload.customer_name || "").trim() || null,
      String(input.payment_method || payload.payment_method || "").trim() || null,
      /^\d{4}-\d{2}-\d{2}$/.test(saleDate) ? saleDate : null,
      JSON.stringify(payload),
      Array.isArray(input.ledger_entry_ids) ? JSON.stringify(input.ledger_entry_ids) : null,
    ]
  );
  return token;
}

export async function loadCustomerBillByToken(token, db = getPool()) {
  await ensureCustomerBillsTable(db);
  const safe = normalizeBillToken(token);
  if (!safe) return null;
  const [rows] = await db.query("SELECT * FROM customer_bills WHERE token = ? LIMIT 1", [safe]);
  return rows[0] || null;
}

export async function createPublicBillForSend(request, input, kind) {
  const payload = saleBillPayloadFromSendInput(input, kind);
  if (!payload.lines.length) return "";
  const token = await createCustomerBill({
    kind,
    invoice_no: payload.invoiceNo,
    customer_phone: payload.customer_phone,
    customer_name: payload.customer_name,
    payment_method: payload.payment_method,
    date: payload.date,
    payload,
    ledger_entry_ids: input.ledger_entry_ids,
  });
  return buildCustomerBillUrl(token, originFromRequest(request));
}
