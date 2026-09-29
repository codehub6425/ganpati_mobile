import InventoryReportsApp from "@/app/components/InventoryReportsApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryReportsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryReportsApp />;
}
