import { parseWhatsappBillLog } from "./whatsapp-bill-log.js";
import { titleCase } from "./format.js";

function entryItemLabel(row) {
  if (row.category === "repair") {
    const detail = row.description || "Repair";
    return row.device_brand ? `${row.device_brand} · ${detail}` : detail;
  }
  return row.description || "Accessory";
}

/**
 * @param {Array<object>} rows DB rows with whatsapp_bill_log
 * @param {Map<number, string>} userNames
 */
export function expandWhatsappBillLogEvents(rows, userNames = new Map()) {
  /** @type {Array<object>} */
  const events = [];
  for (const row of rows) {
    const log = parseWhatsappBillLog(row.whatsapp_bill_log);
    if (!log.length) continue;
    const item = entryItemLabel(row);
    const customerName = row.customer_name ? titleCase(String(row.customer_name)) : null;
    log.forEach((ev, index) => {
      const by = ev.by != null ? Number(ev.by) : null;
      events.push({
        id: `${row.id}-${index}`,
        entry_id: row.id,
        book_date: row.book_date,
        category: row.category,
        item,
        amount: Number(row.amount),
        customer_phone: row.customer_phone || null,
        customer_name: customerName,
        sent_at: ev.at,
        sent_by: by,
        sent_by_name:
          ev.by_name ||
          (by && userNames.get(by) ? userNames.get(by) : null) ||
          null,
        send_number: index + 1,
        send_total: log.length,
      });
    });
  }
  events.sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)));
  return events;
}

export async function fetchUserNamesForIds(db, ids) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map();
  if (!unique.length) return map;
  const [rows] = await db.query(
    `SELECT id, name FROM users WHERE id IN (${unique.map(() => "?").join(",")})`,
    unique
  );
  for (const row of rows) {
    map.set(Number(row.id), row.name ? String(row.name) : `User #${row.id}`);
  }
  return map;
}
