import Link from "next/link";
import { redirect } from "next/navigation";
import CommissionSettingsForm from "@/app/components/CommissionSettingsForm";
import SwalMessage from "@/app/components/SwalMessage";
import WhatsAppConnectPanel from "@/app/components/WhatsAppConnectPanel";
import { getSessionUser } from "@/lib/auth";
import { loadCommissionRules } from "@/lib/commission";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";
import { loadMessageTemplates } from "@/lib/whatsapp-templates";

export default async function AdminSettingsPage() {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    redirect("/admin");
  }

  let rules = [];
  let templateCount = 0;
  let loadError = "";

  try {
    await ensureLeadsTable();
    const db = getPool();
    rules = await loadCommissionRules(db);
    const templates = await loadMessageTemplates(db);
    templateCount = templates.length;
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(error, "Could not load commission settings.");
  }

  return (
    <div className="admin-page admin-settings-page">
      <header className="admin-page-head admin-settings-head">
        <div>
          <h1>Settings</h1>
          <p className="admin-settings-lead">WhatsApp connection, message templates, and commission rules.</p>
        </div>
      </header>
      {loadError ? <SwalMessage type="error" message={loadError} /> : null}
      <WhatsAppConnectPanel />
      <section className="admin-card admin-settings-link-card">
        <div className="admin-settings-link-card-body">
          <h2>Message templates</h2>
          <p className="admin-muted">
            WhatsApp bill text and placeholders for accessory sales
            {templateCount > 0 ? ` · ${templateCount} template${templateCount === 1 ? "" : "s"}` : ""}.
          </p>
        </div>
        <Link className="admin-btn admin-settings-link-btn" href="/admin/settings/templates">
          Manage templates
        </Link>
      </section>
      <CommissionSettingsForm initialRules={rules} />
    </div>
  );
}
