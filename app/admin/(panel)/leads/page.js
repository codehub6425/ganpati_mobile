import LeadActions from "@/app/components/LeadActions";
import LeadsFilters from "@/app/components/LeadsFilters";
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

function formatDistance(km) {
  if (km == null) return "Location not shared";
  const num = Number(km);
  if (!Number.isFinite(num)) return "Location not shared";
  return `${num} km from shop`;
}

function statusLabel(status) {
  if (status === "verified") return "Verified";
  if (status === "spam") return "Spam";
  return "New";
}

function followLabel(status) {
  if (status === "pending") return "Pending";
  if (status === "no_answer") return "No answer";
  if (status === "waiting") return "Waiting";
  if (status === "done") return "Done";
  return "";
}

function isFollowLead(lead) {
  const status = lead.follow_status;
  if (!status || status === "none" || status === "done") return false;
  return true;
}

export default async function AdminLeadsPage({ searchParams }) {
  const params = await searchParams;
  const status = String(params.status || "all").toLowerCase();
  const q = String(params.q || "").trim();
  const brand = String(params.brand || "").trim();
  const problem = String(params.problem || "").trim();
  const distance = String(params.distance || "").trim();
  const from = String(params.from || "").trim();
  const to = String(params.to || "").trim();

  let leads = [];
  let brands = [];
  let problems = [];
  let counts = { new: 0, verified: 0, spam: 0, all: 0, follow: 0 };
  let loadError = "";

  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query("SELECT * FROM leads ORDER BY created_at DESC");
    const [statusRows] = await db.query(
      "SELECT COALESCE(status, 'new') AS status, COUNT(*) AS total FROM leads GROUP BY COALESCE(status, 'new')"
    );

    counts = statusRows.reduce(
      (acc, row) => {
        acc[row.status] = Number(row.total);
        acc.all += Number(row.total);
        return acc;
      },
      { new: 0, verified: 0, spam: 0, all: 0, follow: 0 }
    );

    brands = [...new Set(rows.map((row) => row.brand).filter(Boolean))];
    problems = [...new Set(rows.map((row) => row.problem).filter(Boolean))];

    counts.follow = rows.filter((row) => isFollowLead({ follow_status: row.follow_status })).length;

    leads = rows
      .map((row) => {
        const liveDistance = distanceKm(row.latitude, row.longitude);
        const created = new Date(row.created_at);
        const name = titleCase(row.name);
        const followStatus = row.follow_status || "none";
        const followAt = row.follow_at ? formatDate(row.follow_at) : "";
        const followText = followLabel(followStatus);
        const hasFollowup = followStatus !== "none";
        return {
          ...row,
          name,
          status: row.status || "new",
          initial: name.charAt(0) || "?",
          phone_label: formatPhone(row.phone),
          call_href: telHref(row.phone),
          created_ms: created.getTime(),
          created_at: formatDate(row.created_at),
          distance_km: liveDistance,
          distance_label: formatDistance(liveDistance),
          follow_status: followStatus,
          follow_at_iso: row.follow_at ? new Date(row.follow_at).toISOString() : "",
          follow_at_label: followAt,
          follow_note: row.follow_note || "",
          has_followup: hasFollowup,
          follow_label: followText,
          maps:
            row.latitude && row.longitude
              ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
              : "",
        };
      })
      .filter((lead) => {
        if (status === "follow") {
          if (!isFollowLead(lead)) return false;
        } else if (status !== "all" && lead.status !== status) {
          return false;
        }
        if (brand && lead.brand !== brand) return false;
        if (problem && lead.problem !== problem) return false;
        if (q) {
          const hay = `${lead.name} ${lead.phone}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        if (from) {
          const start = new Date(`${from}T00:00:00`);
          if (!Number.isNaN(start.getTime()) && lead.created_ms < start.getTime()) return false;
        }
        if (to) {
          const end = new Date(`${to}T23:59:59.999`);
          if (!Number.isNaN(end.getTime()) && lead.created_ms > end.getTime()) return false;
        }
        if (distance === "none") {
          if (lead.distance_km != null) return false;
        } else if (distance === "far") {
          if (!(lead.distance_km != null && lead.distance_km > 10)) return false;
        } else if (distance) {
          const maxKm = Number(distance);
          if (!(lead.distance_km != null && lead.distance_km <= maxKm)) return false;
        }
        return true;
      });
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(
      error,
      "Could not load leads. Start MySQL in WAMP and check ganpti_mobile."
    );
  }

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h1>Leads</h1>
          <p>Call, verify, then log the next staff follow-up.</p>
        </div>
        <p className="admin-count">{leads.length}</p>
      </div>

      {loadError ? <p className="admin-error">{loadError}</p> : null}

      {!loadError ? (
        <LeadsFilters
          brands={brands}
          problems={problems}
          current={{ status, q, brand, problem, distance, from, to }}
          counts={counts}
        />
      ) : null}

      {!loadError && leads.length === 0 ? (
        <section className="admin-card">
          <p className="admin-empty">
            No leads in this filter. Try All, or wait for a new form submission.
          </p>
        </section>
      ) : null}

      {leads.length > 0 ? (
        <>
          <div className="admin-lead-cards">
            {leads.map((lead) => (
              <article className="admin-lead-card" key={lead.id}>
                <div className="admin-lead-top">
                  <div className="admin-person">
                    <span className="admin-avatar">{lead.initial}</span>
                    <div>
                      <h2>{lead.name}</h2>
                      <p className="admin-lead-meta">{lead.created_at}</p>
                    </div>
                  </div>
                  <div className="admin-lead-badges">
                    <span className={`admin-status is-${lead.status}`}>{statusLabel(lead.status)}</span>
                    {lead.follow_label ? (
                      <span className={`admin-status is-follow is-${lead.follow_status}`}>{followLabel(lead.follow_status)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="admin-lead-cols">
                  <div>
                    <span className="admin-col-label">Mobile</span>
                    <p className="admin-phone-text">{lead.phone_label}</p>
                  </div>
                  <div>
                    <span className="admin-col-label">Issue</span>
                    <span className="admin-pill is-red">{lead.problem}</span>
                  </div>
                  <div>
                    <span className="admin-col-label">Brand</span>
                    <p className="admin-phone-text">{lead.brand}</p>
                  </div>
                  <div>
                    <span className="admin-col-label">Distance</span>
                    <p className="admin-phone-text">{lead.distance_label}</p>
                  </div>
                </div>
                {lead.note ? <p className="admin-lead-foot">{lead.note}</p> : null}
                {lead.has_followup ? (
                  <div className="admin-follow-summary">
                    <div className="admin-follow-summary-head">
                      <strong>Follow-up</strong>
                      <span className={`admin-status is-follow is-${lead.follow_status}`}>
                        {lead.follow_label || "Saved"}
                      </span>
                    </div>
                    <div className="admin-follow-summary-grid">
                      <div>
                        <span className="admin-col-label">Next call</span>
                        <p>{lead.follow_at_label || "Not set"}</p>
                      </div>
                      <div className={lead.follow_note ? "" : "admin-follow-empty"}>
                        <span className="admin-col-label">Staff note</span>
                        <p>{lead.follow_note || "No note"}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <LeadActions
                  id={lead.id}
                  status={lead.status}
                  phone={lead.phone}
                  name={lead.name}
                  followup={{
                    status: lead.follow_status,
                    at: lead.follow_at_iso,
                    note: lead.follow_note,
                  }}
                />
              </article>
            ))}
          </div>

          <section className="admin-card admin-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Mobile</th>
                    <th>Issue</th>
                    <th>Brand</th>
                    <th>Distance</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Follow-up</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <div className="admin-person">
                          <span className="admin-avatar">{lead.initial}</span>
                          <div>
                            <strong className="admin-strong">{lead.name}</strong>
                            <span className="admin-sub">{lead.device || "Unknown device"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="admin-phone-text">{lead.phone_label}</span>
                      </td>
                      <td>
                        <span className="admin-pill is-red">{lead.problem}</span>
                        {lead.note ? <p className="admin-sub">{lead.note}</p> : null}
                      </td>
                      <td>
                        <span className="admin-pill">{lead.brand}</span>
                      </td>
                      <td>{lead.distance_label}</td>
                      <td>{lead.created_at}</td>
                      <td>
                        <span className={`admin-status is-${lead.status}`}>{statusLabel(lead.status)}</span>
                      </td>
                      <td>
                        {lead.has_followup ? (
                          <div>
                            <span className={`admin-status is-follow is-${lead.follow_status}`}>
                              {lead.follow_label}
                            </span>
                            {lead.follow_at_label ? <p className="admin-sub">{lead.follow_at_label}</p> : null}
                            {lead.follow_note ? <p className="admin-sub">{lead.follow_note}</p> : null}
                          </div>
                        ) : (
                          <span className="admin-sub">Not set</span>
                        )}
                      </td>
                      <td>
                        <LeadActions
                          compact
                          id={lead.id}
                          status={lead.status}
                          phone={lead.phone}
                          name={lead.name}
                          followup={{
                            status: lead.follow_status,
                            at: lead.follow_at_iso,
                            note: lead.follow_note,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
