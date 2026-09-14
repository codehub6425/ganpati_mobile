import PeopleSearch from "@/app/components/PeopleSearch";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { formatPhone, telHref, titleCase } from "@/lib/format";
import { distanceKm } from "@/lib/geo";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminCustomersPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params.q || "").trim();

  let customers = [];
  let loadError = "";

  try {
    await ensureLeadsTable();
    const [rows] = await getPool().query(
      `SELECT u.id, u.name, u.phone, u.created_at, u.lead_id,
              l.brand, l.problem, l.note, l.latitude, l.longitude, l.verified_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN leads l ON l.id = u.lead_id
       WHERE r.slug = 'customer'
       ORDER BY COALESCE(l.verified_at, u.created_at) DESC`
    );

    const seen = new Set();
    customers = rows
      .map((row) => {
        const name = titleCase(row.name);
        const liveDistance = distanceKm(row.latitude, row.longitude);
        return {
          ...row,
          name,
          initial: name.charAt(0) || "?",
          phone_label: row.phone ? formatPhone(row.phone) : "—",
          call_href: telHref(row.phone),
          verified_at: row.verified_at ? formatDate(row.verified_at) : formatDate(row.created_at),
          distance_label:
            liveDistance == null ? "Location not shared" : `${liveDistance} km from shop`,
        };
      })
      .filter((customer) => {
        if (seen.has(customer.id)) return false;
        seen.add(customer.id);
        if (!q) return true;
        const hay = `${customer.name} ${customer.phone || ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(
      error,
      "Could not load customers. Start MySQL in WAMP and check ganpti_mobile."
    );
  }

  return (
    <div className="admin-customers-page">
      <div className="admin-page-head">
        <div>
          <h1>Customers</h1>
          <p>Verified people saved from leads for the shop to call again.</p>
        </div>
        <span className="admin-count-pill">{customers.length} verified</span>
      </div>

      {loadError ? <p className="admin-error">{loadError}</p> : null}

      {!loadError ? (
        <PeopleSearch action="/admin/customers" query={q} placeholder="Search customer name or mobile" />
      ) : null}

      {!loadError && customers.length === 0 ? (
        <section className="admin-customer-empty">
          <strong>No customers yet</strong>
          <p>Open Leads, call the person, then tap Verified. They will appear here.</p>
        </section>
      ) : null}

      {customers.length > 0 ? (
        <div className="admin-people-list is-customers">
          {customers.map((customer) => (
            <article className="admin-customer-card" key={customer.id}>
              <div className="admin-customer-main">
                <span className="admin-avatar">{customer.initial}</span>
                <div className="admin-customer-info">
                  <div className="admin-customer-name-row">
                    <h2>{customer.name}</h2>
                    <span className="admin-status is-customer">Verified</span>
                  </div>
                  <p className="admin-customer-phone">{customer.phone_label}</p>
                </div>
                {customer.call_href ? (
                  <a className="admin-customer-call" href={customer.call_href}>
                    <PhoneIcon />
                    Call
                  </a>
                ) : null}
              </div>
              <div className="admin-customer-meta">
                <div>
                  <span className="admin-col-label">Brand</span>
                  <p>{customer.brand || "—"}</p>
                </div>
                <div>
                  <span className="admin-col-label">Issue</span>
                  {customer.problem ? (
                    <span className="admin-pill is-red">{customer.problem}</span>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div>
                  <span className="admin-col-label">Distance</span>
                  <p>{customer.distance_label}</p>
                </div>
                <div>
                  <span className="admin-col-label">Verified</span>
                  <p>{customer.verified_at}</p>
                </div>
              </div>
              {customer.note ? <p className="admin-customer-note">{customer.note}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.7 3 3.1 3.4 2.7 4 2.7h3.4c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1l-2.1 2.2Z"
      />
    </svg>
  );
}
