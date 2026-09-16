"use client";

import { useEffect, useState } from "react";
import { isMobileAdminDevice, isStandaloneDisplay } from "@/lib/pwa-client";

const DISMISS_KEY = "gmp-admin-browser-hint-dismiss";

export default function AdminBrowserHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay() || !isMobileAdminDevice()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="admin-browser-hint" role="status">
      <p>
        <strong>Browser mode</strong> — the top bar with the website name is Chrome, not the app. Remove
        the old shortcut, then in Chrome open admin → menu → <strong>Install app</strong>, and use only
        that new home-screen icon.
      </p>
      <button type="button" className="admin-browser-hint-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
