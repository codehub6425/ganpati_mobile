import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { userMustChangePassword } from "@/lib/staff";
import "../../admin.css";

export default async function ChangePasswordLayout({ children }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }
  if (!userMustChangePassword(user)) {
    redirect("/admin");
  }
  return children;
}
