import { redirect } from "next/navigation";
import PeopleSearch from "@/app/components/PeopleSearch";
import SwalMessage from "@/app/components/SwalMessage";
import StaffStatusActions from "@/app/components/StaffStatusActions";
import UserForm from "@/app/components/UserForm";
import { getSessionUser } from "@/lib/auth";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { formatAdminDateTimeMedium, titleCase } from "@/lib/format";
import { canManageUsers } from "@/lib/roles";

export default async function AdminStaffPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params.q || "").trim();
  const actor = await getSessionUser();
  if (!canManageUsers(actor)) {
    redirect("/admin");
  }

  let staff = [];
  let loadError = "";

  try {
    await ensureLeadsTable();
    const [rows] = await getPool().query(
      `SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.slug = 'staff'
       ORDER BY u.created_at DESC`
    );

    staff = rows
      .map((row) => {
        const name = titleCase(row.name);
        return {
          ...row,
          name,
          initial: name.charAt(0) || "?",
          created_at: formatAdminDateTimeMedium(row.created_at),
        };
      })
      .filter((person) => {
        if (!q) return true;
        const hay = `${person.name} ${person.email || ""} ${person.phone || ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(
      error,
      "Could not load staff. Start MySQL in WAMP and check ganpti_mobile."
    );
  }

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h1>Staff</h1>
          <p>Shop staff who can log in when active. Suspend an account to block login.</p>
        </div>
        <div className="admin-page-actions">
          <p className="admin-count">{staff.length}</p>
          <UserForm />
        </div>
      </div>

      {loadError ? <SwalMessage message={loadError} /> : null}

      {!loadError ? (
        <PeopleSearch action="/admin/staff" query={q} placeholder="Search name, email, or mobile" />
      ) : null}

      {!loadError && staff.length === 0 ? (
        <section className="admin-card">
          <p className="admin-empty">No staff yet. Add a staff user to give shop login access.</p>
        </section>
      ) : null}

      {staff.length > 0 ? (
        <div className="admin-people-list">
          {staff.map((person) => (
            <article className="admin-lead-card" key={person.id}>
              <div className="admin-lead-top">
                <div className="admin-person">
                  <span className="admin-avatar">{person.initial}</span>
                  <div>
                    <h2>{person.name}</h2>
                    <p className="admin-lead-meta">
                      {person.phone || "No mobile"}
                      {person.email ? ` · ${person.email}` : ""}
                    </p>
                  </div>
                </div>
                <StaffStatusActions
                  userId={person.id}
                  name={person.name}
                  phone={person.phone || ""}
                  email={person.email || ""}
                  status={person.status || "active"}
                  blockSuspend={person.id === actor.id}
                />
              </div>
              <p className="admin-lead-foot">
                {person.status === "suspended" ? "Login blocked" : "Panel access"} · {person.created_at}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
