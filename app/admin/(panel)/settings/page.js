import { redirect } from "next/navigation";
import CommissionSettingsForm from "@/app/components/CommissionSettingsForm";
import SwalMessage from "@/app/components/SwalMessage";
import { getSessionUser } from "@/lib/auth";
import { loadCommissionRules } from "@/lib/commission";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";

export default async function AdminSettingsPage() {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    redirect("/admin");
  }

  let rules = [];
  let loadError = "";

  try {
    await ensureLeadsTable();
    rules = await loadCommissionRules(getPool());
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(error, "Could not load commission settings.");
  }

  return (
    <div className="admin-page admin-settings-page">
      <header className="admin-page-head admin-settings-head">
        <div>
          <h1>Settings</h1>
          <p className="admin-settings-lead">Manage shop defaults and commission rules.</p>
        </div>
      </header>
      {loadError ? <SwalMessage type="error" message={loadError} /> : null}
      <CommissionSettingsForm initialRules={rules} />
    </div>
  );
}
