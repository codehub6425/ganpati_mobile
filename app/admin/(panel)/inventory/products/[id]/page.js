import InventoryProductForm from "@/app/components/InventoryProductForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EditInventoryProductPage({ params }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  const { id } = await params;
  return <InventoryProductForm productId={id} />;
}
