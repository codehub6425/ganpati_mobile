import { NextResponse } from "next/server";
import { isAllowedMediaRequestPath, readMediaBuffer } from "@/lib/media-storage.js";

export async function GET(_request, { params }) {
  const resolved = await params;
  const segments = resolved?.path;
  const parts = Array.isArray(segments) ? segments : segments ? [segments] : [];
  if (!isAllowedMediaRequestPath(parts)) {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  const storageKey = parts.join("/");
  try {
    const buffer = await readMediaBuffer(storageKey);
    if (!buffer) {
      return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("media serve", error);
    return NextResponse.json({ ok: false, message: "Could not load image." }, { status: 500 });
  }
}
