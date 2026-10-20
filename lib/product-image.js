import sharp from "sharp";
import { mediaConfig } from "./media-storage.js";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
]);

export function parseCropJson(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const left = Math.floor(Number(data.left ?? data.x));
  const top = Math.floor(Number(data.top ?? data.y));
  const width = Math.floor(Number(data.width));
  const height = Math.floor(Number(data.height));
  if (![left, top, width, height].every((n) => Number.isFinite(n) && n >= 0)) return null;
  if (width < 1 || height < 1) return null;
  return { left, top, width, height };
}

export function validateImageUpload(file) {
  const { maxUpload } = mediaConfig();
  if (!file || typeof file.arrayBuffer !== "function") {
    return { error: "No image file uploaded." };
  }
  if (file.size > maxUpload) {
    return { error: `Image is too large. Max ${Math.round(maxUpload / (1024 * 1024))} MB.` };
  }
  const type = String(file.type || "").toLowerCase();
  if (type && !ALLOWED_MIME.has(type)) {
    return { error: "Unsupported file type. Use JPG, PNG, WebP, or similar photo formats." };
  }
  return { ok: true };
}

async function encodeWebpUnderBudget(resizedBuffer, startQuality, maxBytes, effort) {
  let quality = startQuality;
  let out = await sharp(resizedBuffer)
    .webp({ quality, effort, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  while (out.data.length > maxBytes && quality > 48) {
    quality = Math.max(48, quality - 10);
    out = await sharp(resizedBuffer)
      .webp({ quality, effort, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
  }

  if (out.data.length <= maxBytes) {
    return out;
  }

  let working = resizedBuffer;
  const meta = await sharp(working).metadata();
  let width = meta.width || maxBytes;
  let height = meta.height || maxBytes;

  while (out.data.length > maxBytes && width > 320 && height > 320) {
    width = Math.max(320, Math.floor(width * 0.85));
    height = Math.max(320, Math.floor(height * 0.85));
    working = await sharp(resizedBuffer)
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    out = await sharp(working)
      .webp({ quality: Math.max(quality, 60), effort, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
  }

  return out;
}

/**
 * @param {Buffer} inputBuffer
 * @param {{ crop?: { left: number, top: number, width: number, height: number } | null, skipCrop?: boolean }} opts
 */
export async function processProductImageBuffer(inputBuffer, opts = {}) {
  const { webpQuality, maxEdge, maxOutputBytes, webpEffort } = mediaConfig();
  let pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();

  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) {
    return { error: "Could not read image. Try another photo." };
  }

  const crop = opts.skipCrop ? null : opts.crop;
  if (crop) {
    const left = Math.min(Math.max(0, crop.left), meta.width - 1);
    const top = Math.min(Math.max(0, crop.top), meta.height - 1);
    const width = Math.min(crop.width, meta.width - left);
    const height = Math.min(crop.height, meta.height - top);
    if (width < 1 || height < 1) {
      return { error: "Invalid crop area." };
    }
    pipeline = sharp(inputBuffer).rotate().extract({ left, top, width, height });
  }

  const resizedBuffer = await pipeline
    .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const out = await encodeWebpUnderBudget(
    resizedBuffer,
    webpQuality,
    maxOutputBytes,
    webpEffort
  );

  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height,
    byteSize: out.data.length,
  };
}
