import InventoryQrManagementApp from "@/app/components/InventoryQrManagementApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryQrPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryQrManagementApp />;
}
