import { Suspense } from "react";
import ListSkeleton from "@/app/components/ListSkeleton";
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
    <Suspense
      fallback={
        <div className="wa-bill-log-page admin-card">
          <ListSkeleton variant="wa-log" rows={8} />
        </div>
      }
    >
      <WhatsappBillLogApp initialFrom={today} initialTo={today} />
    </Suspense>
  );
}
