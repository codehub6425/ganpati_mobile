import {
  deleteMediaKey,
  finalizeStagingToProduct,
  normalizeStorageKey,
  productCoverStorageKey,
  resolveMediaPublicUrl,
} from "./media-storage.js";

export async function applyProductImageFields(body, productId, existingStorageKey = null) {
  const stagingToken = String(body.staging_token || "").trim();
  const requestedKey = body.image_storage_key;
  const clearImage = body.clear_product_image === true || body.clear_product_image === "1";

  if (clearImage) {
    if (existingStorageKey) await deleteMediaKey(existingStorageKey);
    return { image_storage_key: null };
  }

  if (stagingToken) {
    const result = await finalizeStagingToProduct(stagingToken, productId);
    if (result.error) return { error: result.error };
    if (result.skipped) return {};
    if (existingStorageKey && existingStorageKey !== result.storage_key) {
      await deleteMediaKey(existingStorageKey);
    }
    return { image_storage_key: result.storage_key };
  }

  if (requestedKey !== undefined && requestedKey !== null && requestedKey !== "") {
    const key = normalizeStorageKey(requestedKey);
    if (!key) return { error: "Invalid image reference." };
    const expected = productCoverStorageKey(productId);
    if (key !== expected && !key.startsWith(`products/staging/`)) {
      return { error: "Invalid image reference." };
    }
    if (existingStorageKey && existingStorageKey !== key) {
      await deleteMediaKey(existingStorageKey);
    }
    return { image_storage_key: key === expected ? key : expected };
  }

  return {};
}

export function productImageUploadResponse(storageKey, extra = {}) {
  return {
    storage_key: storageKey,
    url: resolveMediaPublicUrl(storageKey),
    ...extra,
  };
}
