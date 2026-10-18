/** @typedef {{ at: string, by: number|null }} WhatsappBillLogRow */

export function parseWhatsappBillLog(raw) {
  if (raw == null || raw === "") return [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const at = row?.at != null ? String(row.at) : "";
      if (!at) return null;
      const by = row?.by != null && row.by !== "" ? Number(row.by) : null;
      const by_name = row?.by_name ? String(row.by_name).trim() : null;
      return {
        at,
        by: Number.isFinite(by) ? by : null,
        ...(by_name ? { by_name } : {}),
      };
    })
    .filter(Boolean);
}

export function normalizeLedgerEntryIds(input) {
  const list = Array.isArray(input) ? input : input != null && input !== "" ? [input] : [];
  const out = [];
  for (const raw of list) {
    const id = Math.floor(Number(raw));
    if (Number.isInteger(id) && id > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Append a send event to ledger row(s) after a successful WhatsApp bill.
 * @param {import("mysql2/promise").Pool} db
 * @param {number[]} entryIds
 * @param {number|null|undefined} userId
 */
export async function recordWhatsappBillSends(db, entryIds, userId, userName) {
  const ids = normalizeLedgerEntryIds(entryIds);
  if (!ids.length) return { updated: 0 };

  const at = new Date().toISOString();
  const by = userId != null && Number.isFinite(Number(userId)) ? Number(userId) : null;
  const by_name = userName ? String(userName).trim() : null;
  const event = { at, by, ...(by_name ? { by_name } : {}) };

  let updated = 0;
  for (const id of ids) {
    const [rows] = await db.query(
      "SELECT id, category, whatsapp_bill_log FROM ledger_entries WHERE id = ? LIMIT 1",
      [id]
    );
    const row = rows[0];
    if (!row || (row.category !== "accessory" && row.category !== "repair")) continue;

    const log = parseWhatsappBillLog(row.whatsapp_bill_log);
    log.push(event);
    await db.execute(
      "UPDATE ledger_entries SET whatsapp_bill_send_count = ?, whatsapp_bill_log = ? WHERE id = ?",
      [log.length, JSON.stringify(log), id]
    );
    updated += 1;
  }

  return { updated, at, count: ids.length };
}

export function whatsappBillLogFromRow(row) {
  const log = parseWhatsappBillLog(row?.whatsapp_bill_log);
  const count =
    Number(row?.whatsapp_bill_send_count) > 0 ?
      Number(row.whatsapp_bill_send_count)
    : log.length;
  const last_at = log.length ? log[log.length - 1].at : null;
  return { count, log, last_at };
}
