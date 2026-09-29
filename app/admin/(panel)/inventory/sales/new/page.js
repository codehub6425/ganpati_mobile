import InventorySaleApp from "@/app/components/InventorySaleApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewInventorySalePage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventorySaleApp />;
}
