import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ensureMediaRoot, mediaConfig } from "@/lib/media-storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

const PURCHASE_BILL_RE = /^purchases\/(\d+)\/bill\.(pdf|webp|jpg|jpeg|png)$/i;

export function normalizePurchaseBillKey(raw) {
  const key = String(raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.includes("..")) return null;
  if (!PURCHASE_BILL_RE.test(key)) return null;
  return key;
}

export function purchaseBillStorageKey(purchaseId, ext) {
  const id = Math.floor(Number(purchaseId));
  if (!id) return null;
  const safeExt = String(ext || "pdf")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const allowed = ["pdf", "webp", "jpg", "jpeg", "png"];
  const use = allowed.includes(safeExt) ? safeExt : "pdf";
  return `purchases/${id}/bill.${use}`;
}

function absolutePathForKey(storageKey) {
  const key = normalizePurchaseBillKey(storageKey);
  if (!key) return null;
  const { localRoot } = mediaConfig();
  const abs = path.resolve(localRoot, key);
  if (!abs.startsWith(localRoot)) return null;
  return abs;
}

export function isAllowedPurchaseBillPath(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length < 3) return false;
  return Boolean(normalizePurchaseBillKey(pathSegments.join("/")));
}

export function contentTypeForPurchaseBillKey(storageKey) {
  const key = normalizePurchaseBillKey(storageKey);
  if (!key) return "application/octet-stream";
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function writePurchaseBillBuffer(purchaseId, buffer, ext) {
  const key = purchaseBillStorageKey(purchaseId, ext);
  if (!key) throw new Error("Invalid purchase id.");
  const abs = absolutePathForKey(key);
  if (!abs) throw new Error("Invalid storage path.");
  await ensureMediaRoot();
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

export async function readPurchaseBillBuffer(storageKey) {
  const abs = absolutePathForKey(storageKey);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function deletePurchaseBillKey(storageKey) {
  const abs = absolutePathForKey(storageKey);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function purchaseBillPublicPath(storageKey) {
  const key = normalizePurchaseBillKey(storageKey);
  if (!key) return null;
  const segments = key.split("/").map((s) => encodeURIComponent(s));
  return `/api/media/${segments.join("/")}`;
}
