import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { userMustChangePassword } from "@/lib/staff";
import AdminShell from "../../components/AdminShell";
import "../../admin.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1728",
};

export default async function AdminPanelLayout({ children }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }
  if (userMustChangePassword(user)) {
    redirect("/admin/change-password");
  }

  return (
    <AdminShell user={{ name: user.name, role: user.role }}>
      {children}
    </AdminShell>
  );
}
