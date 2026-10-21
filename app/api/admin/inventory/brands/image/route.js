import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { brandImageUploadResponse } from "@/lib/brand-image-upload.js";
import {
  brandLogoStorageKey,
  brandStagingStorageKey,
  deleteMediaKey,
  ensureMediaRoot,
  writeMediaBuffer,
} from "@/lib/media-storage.js";
import { parseCropJson, processProductImageBuffer, validateImageUpload } from "@/lib/product-image.js";
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

  const brandIdRaw = formData.get("brand_id");
  const brandId =
    brandIdRaw != null && brandIdRaw !== "" ? Math.floor(Number(brandIdRaw)) : null;
  const stagingToken = String(formData.get("staging_token") || "").trim();
  const skipCrop =
    formData.get("skip_crop") === "1" || String(formData.get("skip_crop")).toLowerCase() === "true";
  const crop = skipCrop ? null : parseCropJson(formData.get("crop"));

  let storageKey = null;
  if (brandId && brandId > 0) {
    storageKey = brandLogoStorageKey(brandId);
  } else if (stagingToken) {
    storageKey = brandStagingStorageKey(stagingToken);
  } else {
    return NextResponse.json(
      { ok: false, message: "Missing brand_id or staging_token." },
      { status: 400 }
    );
  }
  if (!storageKey) {
    return NextResponse.json({ ok: false, message: "Invalid brand or staging token." }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();

    if (brandId) {
      const [rows] = await db.query("SELECT id FROM product_brands WHERE id = ? LIMIT 1", [brandId]);
      if (!rows[0]) {
        return NextResponse.json({ ok: false, message: "Brand not found." }, { status: 404 });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const processed = await processProductImageBuffer(inputBuffer, { crop, skipCrop });
    if (processed.error) {
      return NextResponse.json({ ok: false, message: processed.error }, { status: 422 });
    }

    let previousKey = null;
    if (brandId) {
      const [rows] = await db.query(
        "SELECT image_storage_key FROM product_brands WHERE id = ? LIMIT 1",
        [brandId]
      );
      previousKey = rows[0]?.image_storage_key || null;
    }

    await ensureMediaRoot();
    await writeMediaBuffer(storageKey, processed.buffer);

    if (brandId) {
      await db.execute("UPDATE product_brands SET image_storage_key = ? WHERE id = ?", [
        storageKey,
        brandId,
      ]);
      if (previousKey && previousKey !== storageKey) {
        await deleteMediaKey(previousKey);
      }
    }

    return NextResponse.json({
      ok: true,
      ...brandImageUploadResponse(storageKey, {
        width: processed.width,
        height: processed.height,
        bytes: processed.byteSize,
      }),
    });
  } catch (error) {
    console.error("brand image upload", error);
    return NextResponse.json({ ok: false, message: "Could not save image." }, { status: 500 });
  }
}
