import InventoryProductForm from "@/app/components/InventoryProductForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewInventoryProductPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return <InventoryProductForm />;
}
