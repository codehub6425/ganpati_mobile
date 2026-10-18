import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isStaffUser } from "@/lib/roles";
import { ensureLeadsTable } from "@/lib/db";
import { sendAccessoryBill } from "@/lib/whatsapp-bills";
import { finishWhatsappBillSend } from "@/lib/whatsapp-send-route.js";

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

  const result = await sendAccessoryBill({
    customer_phone,
    customer_name,
    lines,
    payment_method,
    date,
  });

  return finishWhatsappBillSend({ result, userId: user.id, userName: user.name, body });
}
