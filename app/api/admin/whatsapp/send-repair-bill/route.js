import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isStaffUser } from "@/lib/roles";
import { ensureLeadsTable } from "@/lib/db";
import { createPublicBillForSend } from "@/lib/customer-bill";
import { sendRepairBill } from "@/lib/whatsapp-bills";
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
  const invoice_no = body.invoice_no;
  const lines = body.lines;
  const sendInput = {
    customer_phone,
    customer_name,
    lines,
    payment_method,
    date,
    invoice_no,
    ledger_entry_ids: body.ledger_entry_ids,
  };
  let bill_link = "";
  try {
    bill_link = await createPublicBillForSend(request, sendInput, "repair");
  } catch (error) {
    console.error("create repair bill link", error);
  }

  const result = await sendRepairBill({
    ...sendInput,
    bill_link,
  });

  return finishWhatsappBillSend({ result, userId: user.id, userName: user.name, body });
}
