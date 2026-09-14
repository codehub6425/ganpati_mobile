"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const DISMISS_KEY = "gmp-admin-pwa-dismissed";

function getBasePath() {
  return process.env.NODE_ENV === "production" ? "/ganpati-mobile" : "";
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

export default function AdminPwaPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pathname?.startsWith("/admin")) return;

    const base = getBasePath();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${base}/admin/sw.js`, { scope: `${base}/admin/` })
        .catch(() => {});
    }

    if (isStandalone()) return;

    const onPrompt = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (!localStorage.getItem(DISMISS_KEY) && isMobileScreen()) {
      setIos(isIos());
      setOpen(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [pathname]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(DISMISS_KEY, "1");
        setOpen(false);
      }
    } finally {
      setDeferred(null);
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="pwa-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
      <div className="pwa-modal-card">
        <div className="pwa-modal-brand">
          <span className="admin-brand-mark">G</span>
          <div>
            <strong>Ganpati Admin</strong>
            <small>Install the mobile app</small>
          </div>
        </div>
        <h2 id="pwa-title">Use Admin on your phone</h2>
        <p>
          Add the Ganpati admin app to your home screen. It opens straight at
          the admin login.
        </p>
        {ios ? (
          <ol className="pwa-steps">
            <li>
              Tap the <b>Share</b> button
            </li>
            <li>
              Then tap <b>Add to Home Screen</b>
            </li>
          </ol>
        ) : deferred ? (
          <p className="pwa-hint">Install now to open admin like a mobile app.</p>
        ) : (
          <ol className="pwa-steps">
            <li>Open the browser menu</li>
            <li>
              Tap <b>Install app</b> or <b>Add to Home screen</b>
            </li>
          </ol>
        )}
        <div className="pwa-actions">
          {deferred ? (
            <button className="admin-btn" type="button" onClick={install} disabled={busy}>
              {busy ? "Installing..." : "Install app"}
            </button>
          ) : null}
          <button className="pwa-later" type="button" onClick={dismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
