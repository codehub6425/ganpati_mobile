import InventoryProductsApp from "@/app/components/InventoryProductsApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function InventoryProductsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return (
    <Suspense fallback={<p className="admin-empty">Loading…</p>}>
      <InventoryProductsApp />
    </Suspense>
  );
}
