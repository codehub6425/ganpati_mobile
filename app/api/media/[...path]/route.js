import { NextResponse } from "next/server";
import { isAllowedMediaRequestPath, readMediaBuffer } from "@/lib/media-storage.js";
import { isAllowedCustomerDueImagePath } from "@/lib/customer-due-image-storage.js";
import {
  contentTypeForPurchaseBillKey,
  isAllowedPurchaseBillPath,
  readPurchaseBillBuffer,
} from "@/lib/purchase-bill-storage.js";

export async function GET(_request, { params }) {
  const resolved = await params;
  const segments = resolved?.path;
  const parts = Array.isArray(segments) ? segments : segments ? [segments] : [];
  const storageKey = parts.join("/");
  const isProductMedia = isAllowedMediaRequestPath(parts);
  const isPurchaseBill = isAllowedPurchaseBillPath(parts);
  const isCustomerDuePhoto = isAllowedCustomerDueImagePath(parts);
  if (!isProductMedia && !isPurchaseBill && !isCustomerDuePhoto) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  try {
    const buffer =
      isPurchaseBill ? await readPurchaseBillBuffer(storageKey)
      : await readMediaBuffer(storageKey);
    if (!buffer) {
      return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    }
    const contentType =
      isPurchaseBill ? contentTypeForPurchaseBillKey(storageKey) : "image/webp";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("media serve", error);
    return NextResponse.json({ ok: false, message: "Could not load image." }, { status: 500 });
  }
}
