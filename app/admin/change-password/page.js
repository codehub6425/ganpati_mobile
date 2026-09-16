import ChangePasswordForm from "@/app/components/ChangePasswordForm";
import { getSessionUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  return <ChangePasswordForm userName={user?.name || ""} />;
}
