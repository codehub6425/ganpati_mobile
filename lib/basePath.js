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
