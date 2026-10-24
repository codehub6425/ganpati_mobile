import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getQrBatchCodes } from "@/lib/inventory-qr";
import { buildQrScanUrl, originFromRequest } from "@/lib/qr-code";
import { buildQrBatchImages, buildQrBatchPdf, resolveStickerSize } from "@/lib/qr-label-pdf";
import { isStaffUser } from "@/lib/roles";

export const maxDuration = 120;

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

export async function GET(request, { params }) {
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
    const url = new URL(request.url);
    const requestedSize = url.searchParams.get("size");
    const sheet = url.searchParams.get("sheet") || "press12x18";
    const format = String(url.searchParams.get("format") || "pdf").toLowerCase();
    const layout = resolveStickerSize(requestedSize || batch.label_size || "medium", sheet);
    const codes = await getQrBatchCodes(db, id);
    const origin = originFromRequest(request);
    const payloadForCode = (code) => buildQrScanUrl(code, origin);

    if (requestedSize) {
      await db.execute("UPDATE qr_batches SET label_size = ? WHERE id = ?", [layout.id, id]);
    }

    if (format === "png" || format === "jpg" || format === "jpeg" || format === "image") {
      const image = await buildQrBatchImages(codes, {
        prefix: batch.prefix,
        size: layout.id,
        sheet: layout.sheet.id,
        payloadForCode,
      });
      return new NextResponse(image.buffer, {
        headers: {
          "Content-Type": image.contentType,
          "Content-Disposition": `attachment; filename="${image.filename}"`,
        },
      });
    }

    const pdf = await buildQrBatchPdf(codes, {
      prefix: batch.prefix,
      size: layout.id,
      sheet: layout.sheet.id,
      payloadForCode,
    });
    const safeSheet = layout.sheet.id.replace(/[^a-z0-9_-]/gi, "");
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-${safeSheet}-${layout.id}-batch-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not generate file." }, { status: 500 });
  }
}
