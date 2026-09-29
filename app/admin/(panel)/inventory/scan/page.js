import InventoryScanDetailApp from "@/app/components/InventoryScanDetailApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function InventoryScanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return (
    <Suspense fallback={<p className="admin-empty">Loading…</p>}>
      <InventoryScanDetailApp />
    </Suspense>
  );
}
