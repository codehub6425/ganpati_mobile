import InventoryVendorsApp from "@/app/components/InventoryVendorsApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryVendorsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }
  return <InventoryVendorsApp />;
}
