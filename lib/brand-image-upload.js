import {
  brandLogoStorageKey,
  deleteMediaKey,
  finalizeStagingToBrand,
  normalizeStorageKey,
  resolveMediaPublicUrl,
} from "./media-storage.js";

export async function applyBrandImageFields(body, brandId, existingStorageKey = null) {
  const stagingToken = String(body.staging_token || "").trim();
  const clearImage = body.clear_brand_image === true || body.clear_brand_image === "1";

  if (clearImage) {
    if (existingStorageKey) await deleteMediaKey(existingStorageKey);
    return { image_storage_key: null };
  }

  if (stagingToken) {
    const result = await finalizeStagingToBrand(stagingToken, brandId);
    if (result.error) return { error: result.error };
    if (result.skipped) return {};
    if (existingStorageKey && existingStorageKey !== result.storage_key) {
      await deleteMediaKey(existingStorageKey);
    }
    return { image_storage_key: result.storage_key };
  }

  const requestedKey = body.image_storage_key;
  if (requestedKey !== undefined && requestedKey !== null && requestedKey !== "") {
    const key = normalizeStorageKey(requestedKey);
    if (!key) return { error: "Invalid image reference." };
    const expected = brandLogoStorageKey(brandId);
    if (key !== expected && !key.startsWith("brands/staging/")) {
      return { error: "Invalid image reference." };
    }
    if (existingStorageKey && existingStorageKey !== key) {
      await deleteMediaKey(existingStorageKey);
    }
    return { image_storage_key: key === expected ? key : expected };
  }

  return {};
}

export function brandImageUploadResponse(storageKey, extra = {}) {
  return {
    storage_key: storageKey,
    url: resolveMediaPublicUrl(storageKey),
    ...extra,
  };
}
