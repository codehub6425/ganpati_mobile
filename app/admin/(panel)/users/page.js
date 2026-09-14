import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";

export default async function AdminUsersRedirect() {
  const actor = await getSessionUser();
  redirect(canManageUsers(actor) ? "/admin/staff" : "/admin");
}
