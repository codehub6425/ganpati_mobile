import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { normalizeLedgerEntryIds, recordWhatsappBillSends } from "@/lib/whatsapp-bill-log.js";

/**
 * @param {{ result: { ok: boolean, ambiguous?: boolean, error?: string, via?: string }, userId: number, userName?: string, body: object }} ctx
 */
export async function finishWhatsappBillSend({ result, userId, userName, body }) {
  const counted = result.ok || result.ambiguous;
  let bill_log = null;

  if (counted) {
    const entryIds = normalizeLedgerEntryIds(
      body.ledger_entry_ids ?? body.ledger_entry_id ?? []
    );
    if (entryIds.length) {
      const db = getPool();
      bill_log = await recordWhatsappBillSends(db, entryIds, userId, userName);
    }
  }

  if (!result.ok) {
    const message = result.error || "Could not send bill on WhatsApp.";
    const status =
      result.ambiguous ? 503
      : message.toLowerCase().includes("not connected") ? 409
      : 422;
    return NextResponse.json(
      {
        ok: false,
        ambiguous: Boolean(result.ambiguous),
        message,
        bill_log,
      },
      { status }
    );
  }

  return NextResponse.json({ ok: true, via: result.via, bill_log });
}
