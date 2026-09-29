import InventoryDashboard from "@/app/components/InventoryDashboard";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryDashboard />;
}
