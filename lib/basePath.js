export function getBasePath() {
  return process.env.NODE_ENV === "production" ? "/ganpati-mobile" : "";
}

export function getClientBasePath() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/ganpati-mobile")) {
    return "/ganpati-mobile";
  }
  return getBasePath();
}

export function apiUrl(path) {
  const base = getClientBasePath();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function assetUrl(path) {
  return apiUrl(path);
}

/** Product / media URLs from API may be relative (/api/media/...). */
export function productImageSrc(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return apiUrl(raw.startsWith("/") ? raw : `/${raw}`);
}
