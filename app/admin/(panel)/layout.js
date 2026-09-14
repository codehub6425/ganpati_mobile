import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminShell from "../../components/AdminShell";
import "../../admin.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function AdminPanelLayout({ children }) {
  let user = null;
  try {
    user = await getSessionUser();
  } catch (error) {
    console.error(error);
  }
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <AdminShell user={{ name: user.name, role: user.role }}>
      {children}
    </AdminShell>
  );
}
