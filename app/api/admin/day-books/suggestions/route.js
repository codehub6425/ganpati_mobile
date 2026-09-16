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

async function loadSuggestionsForCategory(db, category, paymentFlow = null) {
  const params = [category];
  let flowSql = "";
  if (category === "payment" && paymentFlow) {
    flowSql = " AND COALESCE(payment_flow, 'given') = ?";
    params.push(paymentFlow);
  }

  const [rows] = await db.query(
    `SELECT MIN(description) AS description
     FROM ledger_entries
     WHERE category = ?
       ${flowSql}
       AND description IS NOT NULL
       AND TRIM(description) <> ''
     GROUP BY LOWER(TRIM(description))
     ORDER BY MAX(created_at) DESC
     LIMIT 50`,
    params
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
    for (const cat of ["accessory", "repair"]) {
      if (LEDGER_CATEGORIES.includes(cat)) {
        suggestions[cat] = await loadSuggestionsForCategory(db, cat);
      }
    }
    suggestions.payment = {
      given: await loadSuggestionsForCategory(db, "payment", "given"),
      taken: await loadSuggestionsForCategory(db, "payment", "taken"),
    };
    return NextResponse.json({ ok: true, suggestions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load suggestions." }, { status: 500 });
  }
}
