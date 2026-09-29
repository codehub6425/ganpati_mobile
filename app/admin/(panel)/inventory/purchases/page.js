import InventoryPurchasesApp from "@/app/components/InventoryPurchasesApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryPurchasesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryPurchasesApp />;
}
