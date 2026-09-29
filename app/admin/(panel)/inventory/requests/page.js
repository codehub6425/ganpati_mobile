import InventoryRequestsApp from "@/app/components/InventoryRequestsApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryRequestsApp />;
}
