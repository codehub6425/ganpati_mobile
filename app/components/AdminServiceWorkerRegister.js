"use client";

import { useEffect } from "react";
import { getClientBasePath } from "@/lib/basePath";

/** Register admin SW as early as possible so Chrome can install a true standalone WebAPK. */
export default function AdminServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const base = getClientBasePath();
    const swUrl = `${base}/admin/sw.js`;
    const scope = `${base}/admin/`;
    navigator.serviceWorker.register(swUrl, { scope, updateViaCache: "none" }).catch(() => {});
  }, []);

  return null;
}
