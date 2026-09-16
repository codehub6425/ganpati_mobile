import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  canEditDayBook,
  formatEntryRow,
  normalizeEntryInput,
} from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  return { user };
}

async function loadEntryWithBook(db, entryId) {
  const [rows] = await db.query(
    `SELECT e.*, b.book_date, l.name AS lead_name, l.phone AS lead_phone
     FROM ledger_entries e
     JOIN day_books b ON b.id = e.day_book_id
     LEFT JOIN leads l ON l.id = e.lead_id
     WHERE e.id = ?
     LIMIT 1`,
    [entryId]
  );
  return rows[0] || null;
}

function bookDateStr(row) {
  if (!row?.book_date) return null;
  const d = row.book_date;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString?.().slice(0, 10) || String(d).slice(0, 10);
}

export async function PATCH(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const entryId = Number((await params).id);
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ ok: false, message: "Invalid entry." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = normalizeEntryInput(body);
  if (parsed.error) {
    return NextResponse.json({ ok: false, message: parsed.error }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const existing = await loadEntryWithBook(db, entryId);
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Entry not found." }, { status: 404 });
    }

    const date = bookDateStr(existing);
    if (!canEditDayBook(auth.user, date)) {
      return NextResponse.json({ ok: false, message: "You cannot edit this entry." }, { status: 403 });
    }

    if (parsed.entry.lead_id) {
      const [leads] = await db.query("SELECT id FROM leads WHERE id = ? LIMIT 1", [parsed.entry.lead_id]);
      if (!leads[0]) {
        return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 400 });
      }
    }

    const e = parsed.entry;
    await db.execute(
      `UPDATE ledger_entries
       SET category = ?, amount = ?, transfer_amount = ?, mt_subtype = ?, provider = ?,
           description = ?, payment_method = ?, lead_id = ?, customer_phone = ?, device_brand = ?
       WHERE id = ?`,
      [
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
        entryId,
      ]
    );

    const updated = await loadEntryWithBook(db, entryId);
    return NextResponse.json({ ok: true, entry: formatEntryRow(updated) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not update entry." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  const entryId = Number((await params).id);
  if (!Number.isInteger(entryId) || entryId < 1) {
    return NextResponse.json({ ok: false, message: "Invalid entry." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const existing = await loadEntryWithBook(db, entryId);
    if (!existing) {
      return NextResponse.json({ ok: false, message: "Entry not found." }, { status: 404 });
    }

    const date = bookDateStr(existing);
    if (!canEditDayBook(auth.user, date)) {
      return NextResponse.json({ ok: false, message: "You cannot delete this entry." }, { status: 403 });
    }

    await db.execute("DELETE FROM ledger_entries WHERE id = ?", [entryId]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not delete entry." }, { status: 500 });
  }
}
