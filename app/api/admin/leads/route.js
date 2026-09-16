import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";

export async function GET(request) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const q = String(new URL(request.url).searchParams.get("q") || "").trim();

  try {
    await ensureLeadsTable();
    let rows;
    if (q.length >= 2) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const digits = q.replace(/\D/g, "");
      if (digits.length >= 4) {
        [rows] = await getPool().query(
          `SELECT id, name, phone, brand, problem, note, status, created_at
           FROM leads
           WHERE phone LIKE ? OR name LIKE ?
           ORDER BY created_at DESC
           LIMIT 20`,
          [`%${digits}%`, like]
        );
      } else {
        [rows] = await getPool().query(
          `SELECT id, name, phone, brand, problem, note, status, created_at
           FROM leads
           WHERE name LIKE ?
           ORDER BY created_at DESC
           LIMIT 20`,
          [like]
        );
      }
    } else {
      [rows] = await getPool().query(
        "SELECT id, name, phone, brand, problem, note, status, created_at FROM leads ORDER BY created_at DESC LIMIT 100"
      );
    }
    return NextResponse.json({ ok: true, leads: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, message: "Could not load leads. Check MySQL." },
      { status: 500 }
    );
  }
}
