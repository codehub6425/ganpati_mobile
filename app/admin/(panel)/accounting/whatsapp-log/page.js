import { Suspense } from "react";
import WhatsappBillLogApp from "@/app/components/WhatsappBillLogApp";
import { getSessionUser } from "@/lib/auth";
import { todayDateString } from "@/lib/ledger";
import { redirect } from "next/navigation";

export default async function WhatsappBillLogPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/login");
  }

  const today = todayDateString();

  return (
    <Suspense fallback={<p className="admin-muted">Loading…</p>}>
      <WhatsappBillLogApp initialFrom={today} initialTo={today} />
    </Suspense>
  );
}
