import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import {
  deleteMediaKey,
  ensureMediaRoot,
  productCoverStorageKey,
  productStagingStorageKey,
  writeMediaBuffer,
} from "@/lib/media-storage.js";
import { parseCropJson, processProductImageBuffer, validateImageUpload } from "@/lib/product-image.js";
import { productImageUploadResponse } from "@/lib/product-image-upload.js";
import { isStaffUser } from "@/lib/roles";

export async function POST(request) {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
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

  const productIdRaw = formData.get("product_id");
  const productId =
    productIdRaw != null && productIdRaw !== "" ? Math.floor(Number(productIdRaw)) : null;
  const stagingToken = String(formData.get("staging_token") || "").trim();
  const skipCrop =
    formData.get("skip_crop") === "1" || String(formData.get("skip_crop")).toLowerCase() === "true";
  const crop = skipCrop ? null : parseCropJson(formData.get("crop"));

  let storageKey = null;
  if (productId && productId > 0) {
    storageKey = productCoverStorageKey(productId);
  } else if (stagingToken) {
    storageKey = productStagingStorageKey(stagingToken);
  } else {
    return NextResponse.json(
      { ok: false, message: "Missing product_id or staging_token." },
      { status: 400 }
    );
  }
  if (!storageKey) {
    return NextResponse.json({ ok: false, message: "Invalid product or staging token." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();

    if (productId) {
      const [rows] = await db.query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);
      if (!rows[0]) {
        return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const processed = await processProductImageBuffer(inputBuffer, { crop, skipCrop });
    if (processed.error) {
      return NextResponse.json({ ok: false, message: processed.error }, { status: 422 });
    }

    let previousKey = null;
    if (productId) {
      const [rows] = await db.query(
        "SELECT image_storage_key FROM products WHERE id = ? LIMIT 1",
        [productId]
      );
      previousKey = rows[0]?.image_storage_key || null;
    }

    await ensureMediaRoot();
    await writeMediaBuffer(storageKey, processed.buffer);

    if (productId) {
      await db.execute("UPDATE products SET image_storage_key = ? WHERE id = ?", [storageKey, productId]);
      if (previousKey && previousKey !== storageKey) {
        await deleteMediaKey(previousKey);
      }
    }

    return NextResponse.json({
      ok: true,
      ...productImageUploadResponse(storageKey, {
        width: processed.width,
        height: processed.height,
        bytes: processed.byteSize,
      }),
    });
  } catch (error) {
    console.error("product image upload", error);
    return NextResponse.json({ ok: false, message: "Could not save image." }, { status: 500 });
  }
}
