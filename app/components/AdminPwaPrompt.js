"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getClientBasePath } from "@/lib/basePath";
import { isInAppBrowser, isMobileAdminDevice, isStandaloneDisplay } from "@/lib/pwa-client";

const DISMISS_KEY = "gmp-admin-pwa-dismissed";
const INSTALLED_KEY = "gmp-admin-pwa-installed";
const DISMISS_MS = 24 * 60 * 60 * 1000;

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;
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
  if (isStandaloneDisplay()) return true;
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
  const [openAppHelp, setOpenAppHelp] = useState(false);

  useEffect(() => {
    if (!pathname?.startsWith("/admin")) return;

    if (isStandaloneDisplay()) {
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
        if (isMobileAdminDevice()) {
          setMode("open");
          setOpen(true);
        }
        return;
      }

      if (!isDismissedRecently() && isMobileAdminDevice()) {
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
      setOpenAppHelp(true);
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
        setMode("open");
        setOpenAppHelp(true);
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
            ? "Do not open from Chrome bookmarks — that shows the website bar at the top."
            : failHint
              ? "Open the Chrome menu (3 dots), then tap Install app."
              : "Install now to open admin like a mobile app."}
        </p>
        {isOpenMode || openAppHelp ? (
          <ol className="pwa-steps">
            <li>
              Go to your phone <b>home screen</b>
            </li>
            <li>
              Tap the <b>Ganpati Admin</b> icon (not the Chrome icon)
            </li>
            <li>
              If you only see Chrome, use menu → <b>Install app</b> again
            </li>
          </ol>
        ) : null}
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
            {busy ? "Installing..." : isOpenMode ? "How to open full app" : "Install app"}
          </button>
          <button className="pwa-later" type="button" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
