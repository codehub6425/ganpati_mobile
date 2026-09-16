import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { LEDGER_CATEGORIES } from "@/lib/ledger";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

async function loadSuggestionsForCategory(db, category) {
  const [rows] = await db.query(
    `SELECT MIN(description) AS description
     FROM ledger_entries
     WHERE category = ?
       AND description IS NOT NULL
       AND TRIM(description) <> ''
     GROUP BY LOWER(TRIM(description))
     ORDER BY MAX(created_at) DESC
     LIMIT 50`,
    [category]
  );
  return rows.map((row) => String(row.description || "").trim()).filter(Boolean);
}

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;

  try {
    await ensureLeadsTable();
    const db = getPool();
    const suggestions = {};
    for (const cat of ["accessory", "repair", "payment"]) {
      if (LEDGER_CATEGORIES.includes(cat)) {
        suggestions[cat] = await loadSuggestionsForCategory(db, cat);
      }
    }
    return NextResponse.json({ ok: true, suggestions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load suggestions." }, { status: 500 });
  }
}
