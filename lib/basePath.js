/** App subpath on production host (must match next.config basePath). */
export function getConfiguredBasePath() {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH;
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv.startsWith("/") ? fromEnv.replace(/\/$/, "") : `/${fromEnv.replace(/\/$/, "")}`;
  }
  if (process.env.NODE_ENV === "production") {
    return "/ganpati-mobile";
  }
  return "";
}

export function getBasePath() {
  return getConfiguredBasePath();
}

export function getClientBasePath() {
  if (typeof window !== "undefined") {
    const pub = process.env.NEXT_PUBLIC_BASE_PATH;
    if (pub) {
      return pub.startsWith("/") ? pub.replace(/\/$/, "") : `/${pub.replace(/\/$/, "")}`;
    }
    if (window.location.pathname.startsWith("/ganpati-mobile")) {
      return "/ganpati-mobile";
    }
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
