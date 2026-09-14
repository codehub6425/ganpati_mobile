import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";

export async function GET() {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  try {
    await ensureLeadsTable();
    const [rows] = await getPool().query(
      "SELECT id, name, phone, brand, problem, note, status, created_at FROM leads ORDER BY created_at DESC"
    );
    return NextResponse.json({ ok: true, leads: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, message: "Could not load leads. Check MySQL." },
      { status: 500 }
    );
  }
}
