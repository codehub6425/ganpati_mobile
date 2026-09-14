export function getBasePath() {
  return process.env.NODE_ENV === "production" ? "/ganpati-mobile" : "";
}

export function getClientBasePath() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/ganpati-mobile")) {
    return "/ganpati-mobile";
  }
  return getBasePath();
}
