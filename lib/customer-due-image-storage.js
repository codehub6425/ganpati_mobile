import { normalizeStorageKey } from "@/lib/media-storage.js";

const CUSTOMER_DUE_IMAGE_RE = /^customer-dues\/(\d+)\/(customer|product)\.webp$/;

export function customerDuePhotoStorageKey(dueId, role) {
  const id = Math.floor(Number(dueId));
  const r = String(role || "").trim().toLowerCase();
  if (!id || (r !== "customer" && r !== "product")) return null;
  return `customer-dues/${id}/${r}.webp`;
}

export function normalizeCustomerDueImageKey(raw) {
  const key = String(raw || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.includes("..")) return null;
  if (!CUSTOMER_DUE_IMAGE_RE.test(key)) return null;
  return normalizeStorageKey(key) || key;
}

export function isAllowedCustomerDueImagePath(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length < 3) return false;
  return Boolean(normalizeCustomerDueImageKey(pathSegments.join("/")));
}
