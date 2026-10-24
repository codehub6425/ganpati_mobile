import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { customerDuePhotoStorageKey } from "@/lib/customer-due-image-storage.js";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  deleteMediaKey,
  ensureMediaRoot,
  mediaConfig,
  writeMediaBuffer,
} from "@/lib/media-storage.js";
import { parseCropJson, processProductImageBuffer, validateImageUpload } from "@/lib/product-image.js";
import { isStaffUser } from "@/lib/roles";

export async function POST(request, { params }) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const resolved = await params;
  const dueId = Math.floor(Number(resolved?.id));
  if (!dueId) {
    return NextResponse.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file");
  const check = validateImageUpload(file);
  if (check.error) {
    return NextResponse.json({ ok: false, message: check.error }, { status: 400 });
  }

  const role = String(formData.get("role") || "").trim().toLowerCase();
  if (role !== "customer" && role !== "product") {
    return NextResponse.json({ ok: false, message: "Role must be customer or product." }, { status: 400 });
  }

  const skipCrop =
    formData.get("skip_crop") === "1" || String(formData.get("skip_crop")).toLowerCase() === "true";
  const crop = skipCrop ? null : parseCropJson(formData.get("crop"));
  const storageKey = customerDuePhotoStorageKey(dueId, role);
  if (!storageKey) {
    return NextResponse.json({ ok: false, message: "Invalid storage key." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query("SELECT id FROM customer_dues WHERE id = ? LIMIT 1", [dueId]);
    if (!rows[0]) {
      return NextResponse.json({ ok: false, message: "Customer due not found." }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const processed = await processProductImageBuffer(inputBuffer, { crop, skipCrop });
    if (processed.error) {
      return NextResponse.json({ ok: false, message: processed.error }, { status: 422 });
    }

    const { maxOutputBytes } = mediaConfig();
    if (processed.byteSize > maxOutputBytes) {
      return NextResponse.json(
        { ok: false, message: "Image could not be compressed enough. Try a smaller photo." },
        { status: 422 }
      );
    }

    const [prevRows] = await db.query(
      "SELECT customer_photo_key, product_photo_key FROM customer_dues WHERE id = ? LIMIT 1",
      [dueId]
    );
    const prevKey =
      role === "customer" ?
        prevRows[0]?.customer_photo_key
      : prevRows[0]?.product_photo_key;

    await ensureMediaRoot();
    await writeMediaBuffer(storageKey, processed.buffer);

    const col = role === "customer" ? "customer_photo_key" : "product_photo_key";
    await db.execute(`UPDATE customer_dues SET ${col} = ? WHERE id = ?`, [storageKey, dueId]);
    if (prevKey && prevKey !== storageKey) {
      await deleteMediaKey(prevKey);
    }

    return NextResponse.json({
      ok: true,
      storage_key: storageKey,
      bytes: processed.byteSize,
      width: processed.width,
      height: processed.height,
    });
  } catch (error) {
    console.error("customer-due image", error);
    return NextResponse.json({ ok: false, message: "Could not save image." }, { status: 500 });
  }
}
