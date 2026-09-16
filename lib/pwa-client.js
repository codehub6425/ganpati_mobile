/** Client-only helpers for admin PWA / standalone detection. */

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

export function isMobileAdminDevice() {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia("(max-width: 860px)").matches;
  const phone = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return narrow || (phone && window.innerWidth <= 1024);
}

export function isInAppBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok/i.test(ua) || /; wv\)/i.test(ua);
}
