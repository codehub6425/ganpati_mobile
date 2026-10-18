import Link from "next/link";
import { redirect } from "next/navigation";
import MessageTemplatesForm from "@/app/components/MessageTemplatesForm";
import SwalMessage from "@/app/components/SwalMessage";
import { getSessionUser } from "@/lib/auth";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";
import { loadMessageTemplates, TEMPLATE_PLACEHOLDERS } from "@/lib/whatsapp-templates";

export default async function AdminMessageTemplatesPage() {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    redirect("/admin");
  }

  let templates = [];
  let loadError = "";

  try {
    await ensureLeadsTable();
    templates = await loadMessageTemplates(getPool());
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(error, "Could not load message templates.");
  }

  return (
    <div className="admin-page admin-settings-page">
      <header className="admin-page-head admin-settings-head">
        <div>
          <p className="admin-settings-back">
            <Link href="/admin/settings">← Settings</Link>
          </p>
          <h1>WhatsApp message templates</h1>
          <p className="admin-settings-lead">
            Edit bill and notification text. Add more template keys in the database as you grow
            (repair, inventory, reminders, etc.).
          </p>
        </div>
      </header>
      {loadError ? <SwalMessage type="error" message={loadError} /> : null}
      <MessageTemplatesForm
        initialTemplates={templates}
        initialPlaceholders={TEMPLATE_PLACEHOLDERS}
      />
    </div>
  );
}
