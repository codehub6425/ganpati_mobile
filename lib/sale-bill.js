export const SHOP_BILL = {
  name: "Ganpati Mobile Point",
  line: "Mobile Sales & Accessories",
  address: "Nirman Nagar, Jaipur, Rajasthan 302019",
  phone: "9782932128",
};

export function formatInvoiceNo(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return "";
  return `GM-${String(n).padStart(6, "0")}`;
}

export function normalizeInvoiceNo(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const match = raw.match(/^GM-(\d+)$/) || raw.match(/^(\d+)$/);
  if (!match) return raw;
  return formatInvoiceNo(Number(match[1]));
}

export function formatShopPhone(phone = SHOP_BILL.phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return "";
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function lineWithSerial(description, serial) {
  const name = String(description || "").trim();
  const sn = String(serial || "").trim();
  if (name && sn) return `${name} (SN ${sn})`;
  return name;
}

export function formatBillMoney(n) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export function saleBillTotal(lines) {
  return (lines || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function relatedSaleEntries(entry, allEntries = []) {
  if (!entry) return [];
  const invoiceNo = normalizeInvoiceNo(entry.invoice_no);
  if (invoiceNo) {
    const group = (allEntries || []).filter(
      (row) => normalizeInvoiceNo(row.invoice_no) === invoiceNo
    );
    if (group.length) {
      return group.slice().sort((a, b) => Number(a.id) - Number(b.id));
    }
  }
  return [entry];
}

export function saleBillFromInventorySale(sale) {
  if (!sale?.lines?.length) return null;
  return {
    kind: "accessory",
    invoiceNo: normalizeInvoiceNo(sale.invoice_no) || formatInvoiceNo(sale.id),
    date: sale.sale_date || "",
    time: extrasTimeFromSale(sale),
    customer_name: sale.customer_name || "",
    customer_phone: sale.customer_phone || "",
    payment_method: sale.payment_method || "cash",
    cashier: sale.created_by_name || "",
    lines: sale.lines.map((row) => ({
      description: String(row.product_name || "Item").trim(),
      amount: Number(row.line_total) || 0,
      serial_number: String(row.serial_number || "").trim(),
      made_in_date: String(row.made_in_date || "").trim().slice(0, 10),
      warranty_months: row.warranty_months || null,
      warranty_until: row.warranty_expires_at || row.warranty_until || null,
    })),
  };
}

function extrasTimeFromSale(sale) {
  if (!sale?.created_at) return "";
  try {
    return new Date(sale.created_at).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export function saleBillFromEntries(entries, extras = {}) {
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const first = rows[0] || {};
  return {
    kind: extras.kind || first.category || "accessory",
    invoiceNo: normalizeInvoiceNo(extras.invoiceNo || first.invoice_no) || formatInvoiceNo(first.id),
    date: extras.date || first.book_date || "",
    time: extras.time || "",
    customer_name: extras.customer_name || first.customer_name || "",
    customer_phone: extras.customer_phone || first.customer_phone || "",
    payment_method: extras.payment_method || first.payment_method || "cash",
    cashier: extras.cashier || first.created_by_name || "",
    lines: rows.map((row) => ({
      description: String(row.description || extras.lineDescription || "Item").trim(),
      amount: Number(row.amount) || 0,
      serial_number: String(row.serial_number || "").trim(),
      made_in_date: String(row.made_in_date || "").trim().slice(0, 10),
      warranty_months: row.warranty_months || null,
      warranty_until: row.warranty_until || null,
    })),
  };
}
