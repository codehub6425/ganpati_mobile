import { NextResponse } from "next/server";
import { ensureLeadsTable } from "@/lib/db";
import { loadCustomerBillByToken, publicBillFromRow } from "@/lib/customer-bill";

export async function GET(_request, { params }) {
  await ensureLeadsTable();
  const { token: rawToken } = await params;
  const token = String(rawToken || "");
  const row = await loadCustomerBillByToken(token);
  const bill = publicBillFromRow(row);
  if (!bill?.lines?.length) {
    return NextResponse.json({ ok: false, message: "Bill not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, bill });
}
