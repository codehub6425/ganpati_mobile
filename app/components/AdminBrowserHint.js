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
        <strong>Browser mode</strong> — the bar at the top with <em>bhoomideal.com</em> is Chrome, not
        the app. For a full-screen app, open <strong>Ganpati Admin</strong> from your home screen icon
        (install via Chrome menu → Install app).
      </p>
      <button type="button" className="admin-browser-hint-close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
