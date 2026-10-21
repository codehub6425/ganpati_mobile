import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

const MEDIA_KEY_RE =
  /^(products|brands)\/(\d+|staging\/[a-zA-Z0-9-]{8,64})\/(cover|logo)\.webp$/;

export function mediaConfig() {
  const localRoot = path.resolve(
    PROJECT_ROOT,
    String(process.env.MEDIA_LOCAL_ROOT || "./storage/media").trim()
  );
  const maxUpload = Math.max(
    1024 * 1024,
    Number(process.env.MEDIA_MAX_UPLOAD_BYTES) || 8 * 1024 * 1024
  );
  const webpQuality = Math.min(
    100,
    Math.max(45, Number(process.env.MEDIA_WEBP_QUALITY) || 72)
  );
  const maxEdge = Math.min(
    2048,
    Math.max(320, Number(process.env.MEDIA_MAX_EDGE) || 800)
  );
  const maxOutputKb = Math.min(
    2048,
    Math.max(40, Number(process.env.MEDIA_MAX_OUTPUT_KB) || 200)
  );
  const maxOutputBytes = Math.max(
    40 * 1024,
    Number(process.env.MEDIA_MAX_OUTPUT_BYTES) || maxOutputKb * 1024
  );
  const webpEffort = Math.min(
    6,
    Math.max(3, Number(process.env.MEDIA_WEBP_EFFORT) || 6)
  );
  const cdnBase = String(process.env.MEDIA_CDN_BASE || "").replace(/\/$/, "");
  return {
    localRoot,
    maxUpload,
    webpQuality,
    maxEdge,
    maxOutputBytes,
    webpEffort,
    cdnBase,
    driver: process.env.MEDIA_DRIVER || "local",
  };
}

/** Public browser path (prepend client basePath in UI). */
export function mediaApiPath(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!key) return null;
  const segments = key.split("/").map((s) => encodeURIComponent(s));
  return `/api/media/${segments.join("/")}`;
}

export function resolveMediaPublicUrl(storageKey) {
  const { cdnBase } = mediaConfig();
  const key = normalizeStorageKey(storageKey);
  if (!key) return null;
  if (cdnBase) return `${cdnBase}/${key}`;
  return mediaApiPath(key);
}

export function normalizeStorageKey(raw) {
  const key = String(raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.includes("..")) return null;
  if (!MEDIA_KEY_RE.test(key)) return null;
  return key;
}

export function productCoverStorageKey(productId) {
  const id = Math.floor(Number(productId));
  if (!id) return null;
  return `products/${id}/cover.webp`;
}

export function productStagingStorageKey(stagingToken) {
  const token = String(stagingToken || "")
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "");
  if (token.length < 8 || token.length > 64) return null;
  return `products/staging/${token}/cover.webp`;
}

export function brandLogoStorageKey(brandId) {
  const id = Math.floor(Number(brandId));
  if (!id) return null;
  return `brands/${id}/logo.webp`;
}

export function brandStagingStorageKey(stagingToken) {
  const token = String(stagingToken || "")
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "");
  if (token.length < 8 || token.length > 64) return null;
  return `brands/staging/${token}/logo.webp`;
}

export function isAllowedMediaRequestPath(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length < 3) return false;
  const key = pathSegments.join("/");
  return Boolean(normalizeStorageKey(key));
}

function absolutePathForKey(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!key) return null;
  const { localRoot } = mediaConfig();
  const abs = path.resolve(localRoot, key);
  if (!abs.startsWith(localRoot)) return null;
  return abs;
}

export async function ensureMediaRoot() {
  const { localRoot } = mediaConfig();
  await fs.mkdir(localRoot, { recursive: true });
}

export async function writeMediaBuffer(storageKey, buffer) {
  const key = normalizeStorageKey(storageKey);
  if (!key) throw new Error("Invalid storage key.");
  const abs = absolutePathForKey(key);
  if (!abs) throw new Error("Invalid storage path.");
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

export async function readMediaBuffer(storageKey) {
  const abs = absolutePathForKey(storageKey);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteMediaKey(storageKey) {
  const key = normalizeStorageKey(storageKey);
  if (!key) return false;
  const abs = absolutePathForKey(key);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/** Move staging file to final product key; deletes staging dir if empty. */
export async function finalizeStagingToProduct(stagingToken, productId) {
  const fromKey = productStagingStorageKey(stagingToken);
  const toKey = productCoverStorageKey(productId);
  if (!fromKey || !toKey) return { error: "Invalid staging or product id." };

  const fromAbs = absolutePathForKey(fromKey);
  const toAbs = absolutePathForKey(toKey);
  if (!fromAbs || !toAbs) return { error: "Invalid storage path." };

  try {
    await fs.access(fromAbs);
  } catch {
    return { error: null, skipped: true };
  }

  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  try {
    await fs.rename(fromAbs, toAbs);
  } catch {
    const buf = await fs.readFile(fromAbs);
    await fs.writeFile(toAbs, buf);
    await fs.unlink(fromAbs).catch(() => {});
  }

  const stagingDir = path.dirname(fromAbs);
  await fs.rmdir(stagingDir).catch(() => {});

  return { storage_key: toKey, error: null };
}

/** Move brand staging file to final brand logo key. */
export async function finalizeStagingToBrand(stagingToken, brandId) {
  const fromKey = brandStagingStorageKey(stagingToken);
  const toKey = brandLogoStorageKey(brandId);
  if (!fromKey || !toKey) return { error: "Invalid staging or brand id." };

  const fromAbs = absolutePathForKey(fromKey);
  const toAbs = absolutePathForKey(toKey);
  if (!fromAbs || !toAbs) return { error: "Invalid storage path." };

  try {
    await fs.access(fromAbs);
  } catch {
    return { error: null, skipped: true };
  }

  await fs.mkdir(path.dirname(toAbs), { recursive: true });
  try {
    await fs.rename(fromAbs, toAbs);
  } catch {
    const buf = await fs.readFile(fromAbs);
    await fs.writeFile(toAbs, buf);
    await fs.unlink(fromAbs).catch(() => {});
  }

  const stagingDir = path.dirname(fromAbs);
  await fs.rmdir(stagingDir).catch(() => {});

  return { storage_key: toKey, error: null };
}
