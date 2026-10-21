import InventoryProductsApp from "@/app/components/InventoryProductsApp";
import ListSkeleton from "@/app/components/ListSkeleton";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function InventoryProductsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return (
    <Suspense
      fallback={
        <div className="inventory-app inv-products-list-page">
          <section className="admin-card inv-table-section inv-table-card">
            <ListSkeleton variant="product" rows={8} />
          </section>
        </div>
      }
    >
      <InventoryProductsApp />
    </Suspense>
  );
}
