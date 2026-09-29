import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getQrBatchCodes } from "@/lib/inventory-qr";
import { buildQrBatchPdf } from "@/lib/qr-label-pdf";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(_request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!id) return NextResponse.json({ ok: false, message: "Invalid batch." }, { status: 400 });
  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query("SELECT * FROM qr_batches WHERE id = ? LIMIT 1", [id]);
    const batch = rows[0];
    if (!batch) return NextResponse.json({ ok: false, message: "Batch not found." }, { status: 404 });
    const codes = await getQrBatchCodes(db, id);
    const pdf = await buildQrBatchPdf(codes, { prefix: batch.prefix });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-batch-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not generate PDF." }, { status: 500 });
  }
}
