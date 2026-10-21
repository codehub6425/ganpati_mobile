import InventoryBrandsApp from "@/app/components/InventoryBrandsApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryBrandsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryBrandsApp isAdmin={user.role === "admin"} />;
}
