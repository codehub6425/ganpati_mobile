import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  canEditDayBook,
  formatEntryRow,
  normalizeEntryInput,
  parseBookDate,
  todayDateString,
} from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  return { user };
}

async function getDayBook(db, bookDate) {
  const [rows] = await db.query("SELECT * FROM day_books WHERE book_date = ? LIMIT 1", [bookDate]);
  return rows[0] || null;
}

async function ensureDayBook(db, bookDate, userId) {
  let book = await getDayBook(db, bookDate);
  if (book) return book;
  const [result] = await db.execute(
    "INSERT INTO day_books (book_date, created_by) VALUES (?, ?)",
    [bookDate, userId]
  );
  const [created] = await db.query("SELECT * FROM day_books WHERE id = ? LIMIT 1", [result.insertId]);
  return created[0];
}

export async function POST(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const parsed = normalizeEntryInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }

  const bookDate = parseBookDate(body.date) || todayDateString();
  if (!canEditDayBook(auth.user, bookDate)) {
    return NextResponse.json({ ok: false, message: "You cannot add entries for this date." }, { status: 403 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();

    if (parsed.entry.lead_id) {
      const [leads] = await db.query("SELECT id FROM leads WHERE id = ? LIMIT 1", [parsed.entry.lead_id]);
      if (!leads[0]) {
        return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 400 });
      }
    }

    const book = await ensureDayBook(db, bookDate, auth.user.id);
    const e = parsed.entry;
    const [result] = await db.execute(
      `INSERT INTO ledger_entries
        (day_book_id, category, amount, transfer_amount, mt_subtype, provider, description, payment_method, lead_id, customer_phone, device_brand, payment_flow, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        e.category,
        e.amount,
        e.transfer_amount,
        e.mt_subtype,
        e.provider,
        e.description,
        e.payment_method,
        e.lead_id,
        e.customer_phone,
        e.device_brand,
        e.payment_flow,
        auth.user.id,
      ]
    );

    const [rows] = await db.query(
      `SELECT e.*, b.book_date, l.name AS lead_name, l.phone AS lead_phone, u.name AS created_by_name
       FROM ledger_entries e
       JOIN day_books b ON b.id = e.day_book_id
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return NextResponse.json({ ok: true, entry: formatEntryRow(rows[0]) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not save entry." }, { status: 500 });
  }
}
