"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client redirect so old bookmarks/HMR chunks don’t load removed page bundles. */
export default function InventoryProductRouteRedirect({ editId = null }) {
  const router = useRouter();

  useEffect(() => {
    const qs = editId ? `?edit=${encodeURIComponent(String(editId))}` : "";
    router.replace(`/admin/inventory/products${qs}`);
  }, [editId, router]);

  return <p className="admin-empty">Opening product inventory…</p>;
}
