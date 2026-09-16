import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  canEditDayBook,
  computeTotals,
  formatEntryRow,
  parseBookDate,
  todayDateString,
} from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  return { user };
}

async function getOrCreateDayBook(db, bookDate, userId) {
  const [existing] = await db.query("SELECT * FROM day_books WHERE book_date = ? LIMIT 1", [bookDate]);
  if (existing[0]) return existing[0];

  const [result] = await db.execute(
    "INSERT INTO day_books (book_date, created_by) VALUES (?, ?)",
    [bookDate, userId]
  );
  const [created] = await db.query("SELECT * FROM day_books WHERE id = ? LIMIT 1", [result.insertId]);
  return created[0];
}

async function loadEntriesForBook(db, dayBookId) {
  const [rows] = await db.query(
    `SELECT e.*, b.book_date, l.name AS lead_name, l.phone AS lead_phone, u.name AS created_by_name
     FROM ledger_entries e
     JOIN day_books b ON b.id = e.day_book_id
     LEFT JOIN leads l ON l.id = e.lead_id
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.day_book_id = ?
     ORDER BY e.created_at ASC, e.id ASC`,
    [dayBookId]
  );
  return rows.map(formatEntryRow);
}

async function loadEntriesForRange(db, fromDate, toDate) {
  const [rows] = await db.query(
    `SELECT e.*, b.book_date, l.name AS lead_name, l.phone AS lead_phone, u.name AS created_by_name
     FROM ledger_entries e
     JOIN day_books b ON b.id = e.day_book_id
     LEFT JOIN leads l ON l.id = e.lead_id
     LEFT JOIN users u ON u.id = e.created_by
     WHERE b.book_date >= ? AND b.book_date <= ?
     ORDER BY b.book_date ASC, e.created_at ASC, e.id ASC`,
    [fromDate, toDate]
  );
  return rows.map(formatEntryRow);
}

function resolveDateRange(searchParams) {
  const today = todayDateString();
  let from = parseBookDate(searchParams.get("from")) || parseBookDate(searchParams.get("date"));
  let to = parseBookDate(searchParams.get("to")) || from;
  if (!from) from = today;
  if (!to) to = from;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export async function GET(request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const params = new URL(request.url).searchParams;
  const { from, to } = resolveDateRange(params);
  const isRange = from !== to;
  const today = todayDateString();

  if (auth.user.role === "staff" && (from !== today || to !== today)) {
    return NextResponse.json(
      { ok: false, message: "Staff can only open today's day book." },
      { status: 403 }
    );
  }

  if (to > today) {
    return NextResponse.json({ ok: false, message: "Future dates are not allowed." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();

    let entries;
    let book;

    if (isRange) {
      entries = await loadEntriesForRange(db, from, to);
      book = {
        id: null,
        book_date: from,
        book_date_to: to,
        note: null,
        can_edit: false,
        is_range: true,
      };
    } else {
      const row = await getOrCreateDayBook(db, from, auth.user.id);
      entries = await loadEntriesForBook(db, row.id);
      book = {
        id: row.id,
        book_date: row.book_date,
        book_date_to: row.book_date,
        note: row.note,
        can_edit: canEditDayBook(auth.user, from),
        is_range: false,
      };
    }

    const totals = computeTotals(entries);

    return NextResponse.json({
      ok: true,
      book,
      entries,
      totals,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load day book." }, { status: 500 });
  }
}
