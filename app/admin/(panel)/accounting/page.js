import DayBookApp from "@/app/components/DayBookApp";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AccountingPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  return <DayBookApp userRole={user.role} />;
}
