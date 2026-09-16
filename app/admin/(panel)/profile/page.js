import ProfileForm from "@/app/components/ProfileForm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <ProfileForm initialName={user.name || ""} email={user.email || ""} role={user.role || "staff"} />
  );
}
