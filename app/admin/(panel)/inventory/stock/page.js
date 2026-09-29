import InventoryQrStockListApp from "@/app/components/InventoryQrStockListApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function InventoryStockPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryQrStockListApp />;
}
