import DashboardHome from "@/app/components/DashboardHome";
import SwalMessage from "@/app/components/SwalMessage";
import { getSessionUser } from "@/lib/auth";
import { dbErrorMessage, ensureLeadsTable, getPool } from "@/lib/db";
import { titleCase } from "@/lib/format";
import { distanceKm } from "@/lib/geo";

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function AdminDashboardPage() {
  const user = await getSessionUser();
  let leads = [];
  let customerCount = 0;
  let loadError = "";

  try {
    await ensureLeadsTable();
    const db = getPool();
    const [rows] = await db.query("SELECT * FROM leads ORDER BY created_at DESC");
    const [customerRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.slug = 'customer'`
    );
    leads = rows.map((row) => ({
      ...row,
      name: titleCase(row.name),
      status: row.status || "new",
      distance_km: distanceKm(row.latitude, row.longitude),
    }));
    customerCount = Number(customerRows[0]?.total || 0);
  } catch (error) {
    console.error(error);
    loadError = dbErrorMessage(
      error,
      "Could not load data. Start MySQL in WAMP and check ganpti_mobile."
    );
  }

  const start = todayStart();
  const todayCount = leads.filter((lead) => new Date(lead.created_at) >= start).length;
  const newCount = leads.filter((lead) => lead.status === "new").length;
  const spamCount = leads.filter((lead) => lead.status === "spam").length;
  const recent = leads
    .filter((lead) => lead.status === "new")
    .slice(0, 5)
    .map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      brand: lead.brand,
      problem: lead.problem,
      distance_km: lead.distance_km,
      initial: lead.name.charAt(0) || "?",
      created_label: new Date(lead.created_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    }));

  const stats = [
    { id: "new", label: "New leads", value: newCount, hint: "Waiting for a call", icon: "☎" },
    { id: "verified", label: "Verified customers", value: customerCount, hint: "Saved for staff", icon: "✓" },
    { id: "today", label: "Today", value: todayCount, hint: "Requests received", icon: "☀" },
    { id: "spam", label: "Spam hidden", value: spamCount, hint: "Filtered out", icon: "⊘" },
  ];

  return (
    <>
      {loadError ? <SwalMessage message={loadError} /> : null}
      <DashboardHome stats={stats} recent={recent} userName={user?.name || "Shubham"} />
    </>
  );
}
