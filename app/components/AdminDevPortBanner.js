"use client";

import { useEffect, useState } from "react";

/** Warn when admin is opened on the WhatsApp gateway port (local dev). */
export default function AdminDevPortBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const port = window.location.port;
    if (port === "3001") {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="admin-dev-port-banner" role="alert">
      <strong>Wrong port.</strong> This admin app should run on{" "}
      <a href={`http://${window.location.hostname}:3000${window.location.pathname}${window.location.search}`}>
        port 3000
      </a>
      . Port 3001 is for the WhatsApp gateway — pages here will show chunk errors.
    </div>
  );
}
