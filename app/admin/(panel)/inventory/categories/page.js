import InventoryCategoriesApp from "@/app/components/InventoryCategoriesApp";

import { getSessionUser } from "@/lib/auth";

import { redirect } from "next/navigation";



export default async function InventoryCategoriesPage() {

  const user = await getSessionUser();

  if (!user) redirect("/admin/login");

  return <InventoryCategoriesApp isAdmin={user.role === "admin"} />;

}

