"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getClientBasePath } from "@/lib/basePath";

const DISMISS_KEY = "gmp-admin-pwa-dismissed";
const INSTALLED_KEY = "gmp-admin-pwa-installed";
const LAUNCH_KEY = "gmp-admin-pwa-launch-tried";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function adminStartUrl() {
  return `${window.location.origin}${getClientBasePath()}/admin/login`;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isMobileScreen() {
  const narrow = window.matchMedia("(max-width: 860px)").matches;
  const phone = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return narrow || (phone && window.innerWidth <= 1024);
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Twitter|TikTok/i.test(ua) || /; wv\)/i.test(ua);
}

function currentPrompt() {
  return window.__gmpPwa?.deferred || null;
}

function storePrompt(event) {
  window.__gmpPwa = window.__gmpPwa || {};
  window.__gmpPwa.deferred = event;
  window.dispatchEvent(new Event("gmp-pwa-ready"));
}

function registerAdminWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve();
  const base = getClientBasePath();
  return navigator.serviceWorker.register(`${base}/admin/sw.js`, {
    scope: `${base}/admin/`,
    updateViaCache: "none",
  });
}

async function isAppInstalled() {
  if (isStandalone()) return true;
  if (localStorage.getItem(INSTALLED_KEY) === "1") return true;
  try {
    if (navigator.getInstalledRelatedApps) {
      const apps = await navigator.getInstalledRelatedApps();
      if (apps.length > 0) return true;
    }
  } catch {
    // Browser may block this API.
  }
  return false;
}

function isDismissedRecently() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at < 1e12) return false;
  return Date.now() - at < DISMISS_MS;
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, "1");
}

function openInstalledApp() {
  const startUrl = adminStartUrl();
  const url = new URL(startUrl);
  if (isAndroid()) {
    window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(startUrl)};end`;
    return;
  }
  window.location.replace(startUrl);
}

function openInChrome() {
  const href = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `intent://${href}#Intent;scheme=https;package=com.android.chrome;end`;
}

export default function AdminPwaPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("install");
  const [busy, setBusy] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [failHint, setFailHint] = useState(false);

  useEffect(() => {
    if (!pathname?.startsWith("/admin")) return;

    if (isStandalone()) {
      markInstalled();
      return;
    }

    const onPrompt = (event) => {
      storePrompt(event);
    };
    const onInstalled = () => {
      markInstalled();
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    registerAdminWorker().catch(() => {});

    let cancelled = false;
    (async () => {
      const installed = await isAppInstalled();
      if (cancelled) return;

      if (installed) {
        if (!sessionStorage.getItem(LAUNCH_KEY)) {
          sessionStorage.setItem(LAUNCH_KEY, "1");
          openInstalledApp();
          return;
        }
        if (isMobileScreen()) {
          setMode("open");
          setOpen(true);
        }
        return;
      }

      if (!isDismissedRecently() && isMobileScreen()) {
        setMode("install");
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [pathname]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  function install() {
    if (mode === "open") {
      openInstalledApp();
      return;
    }

    if (isIos()) {
      setIosHelp(true);
      return;
    }

    if (isInAppBrowser()) {
      openInChrome();
      return;
    }

    const promptEvent = currentPrompt();
    if (promptEvent) {
      setBusy(true);
      try {
        promptEvent.prompt();
      } catch {
        setBusy(false);
        return;
      }
      promptEvent.userChoice
        .then((choice) => {
          window.__gmpPwa = window.__gmpPwa || {};
          window.__gmpPwa.deferred = null;
          if (choice.outcome === "accepted") {
            markInstalled();
            setOpen(false);
          }
        })
        .finally(() => setBusy(false));
      return;
    }

    isAppInstalled().then((installed) => {
      if (installed) {
        markInstalled();
        openInstalledApp();
        return;
      }
      setFailHint(true);
    });
  }

  if (!open) return null;

  const isOpenMode = mode === "open";

  return (
    <div className="pwa-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
      <div className="pwa-modal-card">
        <div className="pwa-modal-brand">
          <span className="admin-brand-mark">G</span>
          <div>
            <strong>Ganpati Admin</strong>
            <small>{isOpenMode ? "App already installed" : "Install the mobile app"}</small>
          </div>
        </div>
        <h2 id="pwa-title">{isOpenMode ? "Open the admin app" : "Use Admin on your phone"}</h2>
        <p>
          {isOpenMode
            ? "The Ganpati admin app is already on this phone. Open it for faster login."
            : "Add the Ganpati admin app to your home screen. It opens straight at the admin login."}
        </p>
        <p className="pwa-hint">
          {isOpenMode
            ? "Tap below to open the installed app."
            : failHint
              ? "Open the Chrome menu (3 dots), then tap Install app."
              : "Install now to open admin like a mobile app."}
        </p>
        {iosHelp ? (
          <ol className="pwa-steps">
            <li>
              Tap the <b>Share</b> button
            </li>
            <li>
              Then tap <b>Add to Home Screen</b>
            </li>
          </ol>
        ) : null}
        <div className="pwa-actions">
          <button className="admin-btn" type="button" onClick={install} disabled={busy}>
            {busy ? "Installing..." : isOpenMode ? "Open app" : "Install app"}
          </button>
          <button className="pwa-later" type="button" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
