import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { getPurchaseById, setPurchaseBillKey } from "@/lib/inventory-purchases";
import { deletePurchaseBillKey, writePurchaseBillBuffer } from "@/lib/purchase-bill-storage";
import { isStaffUser } from "@/lib/roles";

async function requireStaff() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return { error: NextResponse.json({ ok: false, message: "Login required." }, { status: 401 }) };
  }
  return { user };
}

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request, { params }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const resolved = await params;
  const purchaseId = resolved?.id;
  try {
    await ensureLeadsTable();
    const db = getPool();
    const detail = await getPurchaseById(db, purchaseId);
    if (!detail) {
      return NextResponse.json({ ok: false, message: "Purchase not found." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ ok: false, message: "Choose a file to upload." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, message: "File is too large (max 12 MB)." }, { status: 400 });
    }
    const name = String(file.name || "bill.pdf");
    const ext = name.includes(".") ? name.split(".").pop() : "pdf";

    if (detail.purchase.bill_storage_key) {
      await deletePurchaseBillKey(detail.purchase.bill_storage_key);
    }
    const storageKey = await writePurchaseBillBuffer(purchaseId, buffer, ext);
    await setPurchaseBillKey(db, purchaseId, storageKey);
    const updated = await getPurchaseById(db, purchaseId);
    return NextResponse.json({ ok: true, purchase: updated?.purchase });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not upload bill." }, { status: 500 });
  }
}
