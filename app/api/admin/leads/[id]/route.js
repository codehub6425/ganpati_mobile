import { NextResponse } from "next/server";
import { isAdminLoggedIn } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { upsertCustomerFromLead } from "@/lib/users";

const STATUSES = new Set(["new", "verified", "spam"]);
const FOLLOWUPS = new Set(["none", "pending", "no_answer", "waiting", "done"]);

function parseFollowupAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(request, { params }) {
  if (!(await isAdminLoggedIn())) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId < 1) {
    return NextResponse.json({ ok: false, message: "Invalid lead." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query("SELECT * FROM leads WHERE id = ? LIMIT 1", [leadId]);
    const lead = rows[0];
    if (!lead) {
      return NextResponse.json({ ok: false, message: "Lead not found." }, { status: 404 });
    }

    if (body.followup) {
      const followStatus = String(body.followup.status || "pending").toLowerCase();
      if (!FOLLOWUPS.has(followStatus)) {
        return NextResponse.json({ ok: false, message: "Invalid follow-up." }, { status: 400 });
      }
      const note = String(body.followup.note || "").trim().slice(0, 200);
      const at = parseFollowupAt(body.followup.at);
      const now = new Date();
      await db.execute(
        `UPDATE leads
         SET follow_status = ?, follow_at = ?, follow_note = ?, follow_updated_at = ?
         WHERE id = ?`,
        [followStatus, at, note || null, now, leadId]
      );
      await db.execute(
        `INSERT INTO follow_ups (lead_id, follow_status, follow_at, note) VALUES (?, ?, ?, ?)`,
        [leadId, followStatus, at, note || null]
      );
      return NextResponse.json({ ok: true, followup: true });
    }

    const status = String(body.status || "").toLowerCase();
    if (!STATUSES.has(status)) {
      return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 400 });
    }

    const verifiedAt = status === "verified" ? new Date() : null;
    if (status === "verified") {
      await upsertCustomerFromLead(db, lead);
    }
    await db.execute("UPDATE leads SET status = ?, verified_at = ? WHERE id = ?", [
      status,
      verifiedAt,
      leadId,
    ]);

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, message: "Could not update this lead." },
      { status: 500 }
    );
  }
}
