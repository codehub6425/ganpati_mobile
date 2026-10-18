import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isStaffUser } from "@/lib/roles";
import { ensureLeadsTable } from "@/lib/db";
import { sendRepairBill } from "@/lib/whatsapp-bills";

export async function POST(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  await ensureLeadsTable();

  const body = await request.json().catch(() => ({}));
  const customer_phone = String(body.customer_phone || "").replace(/\D/g, "").slice(-10);
  const customer_name = String(body.customer_name || "").trim();
  const payment_method = body.payment_method;
  const date = body.date;
  const lines = body.lines;

  const result = await sendRepairBill({
    customer_phone,
    customer_name,
    lines,
    payment_method,
    date,
  });

  if (!result.ok) {
    const message = result.error || "Could not send bill on WhatsApp.";
    const status =
      result.ambiguous ? 503
      : message.toLowerCase().includes("not connected") ? 409
      : 422;
    return NextResponse.json(
      { ok: false, ambiguous: Boolean(result.ambiguous), message },
      { status }
    );
  }

  return NextResponse.json({ ok: true, via: result.via });
}
