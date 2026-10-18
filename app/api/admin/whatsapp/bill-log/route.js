import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { parseBookDate, todayDateString } from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";
import {
  expandWhatsappBillLogEvents,
  fetchUserNamesForIds,
} from "@/lib/whatsapp-bill-log-query.js";
import { parseWhatsappBillLog } from "@/lib/whatsapp-bill-log.js";

export async function GET(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  await ensureLeadsTable();
  const db = getPool();
  const { searchParams } = new URL(request.url);
  const entryIdRaw = searchParams.get("entry_id");
  const entryId =
    entryIdRaw != null && entryIdRaw !== "" ? Math.floor(Number(entryIdRaw)) : null;

  const today = todayDateString();
  const from = parseBookDate(searchParams.get("from")) || today;
  const to = parseBookDate(searchParams.get("to")) || from;
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 200));

  try {
    const params = [];
    let sql = `
      SELECT e.id, e.category, e.description, e.device_brand, e.amount, e.customer_phone,
             e.whatsapp_bill_log, e.whatsapp_bill_send_count, b.book_date,
             cust.name AS customer_name
      FROM ledger_entries e
      JOIN day_books b ON b.id = e.day_book_id
      LEFT JOIN users cust ON cust.phone = e.customer_phone
        AND cust.role_id = (SELECT id FROM roles WHERE slug = 'customer' LIMIT 1)
      WHERE e.category IN ('accessory', 'repair')
        AND e.whatsapp_bill_send_count > 0
    `;

    if (entryId && entryId > 0) {
      sql += " AND e.id = ?";
      params.push(entryId);
    } else {
      sql += " AND b.book_date >= ? AND b.book_date <= ?";
      params.push(from, to);
    }

    sql += " ORDER BY b.book_date DESC, e.id DESC";

    const [rows] = await db.query(sql, params);

    const staffIds = [];
    for (const row of rows) {
      for (const ev of parseWhatsappBillLog(row.whatsapp_bill_log)) {
        if (ev.by) staffIds.push(ev.by);
      }
    }
    const userNames = await fetchUserNamesForIds(db, staffIds);
    let events = expandWhatsappBillLogEvents(rows, userNames);
    events = events.slice(0, limit);

    return NextResponse.json({
      ok: true,
      from: entryId ? null : from,
      to: entryId ? null : to,
      entry_id: entryId || null,
      total: events.length,
      events,
    });
  } catch (error) {
    console.error("whatsapp bill-log", error);
    return NextResponse.json({ ok: false, message: "Could not load WhatsApp log." }, { status: 500 });
  }
}
