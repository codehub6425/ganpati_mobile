import { titleCase } from "@/lib/format";

export const USER_WITH_ROLE = `
  SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, u.lead_id, u.role_id, u.created_at,
         r.slug AS role, r.name AS role_name
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
`;

export async function upsertCustomerFromLead(db, lead) {
  const [roleRows] = await db.query("SELECT id FROM roles WHERE slug = 'customer' LIMIT 1");
  const customerRoleId = Number(roleRows[0]?.id) || null;
  if (!customerRoleId) {
    throw new Error("Customer role is missing.");
  }

  const name = titleCase(lead.name);
  const phone = String(lead.phone || "").replace(/\D/g, "").slice(-10);
  if (!phone) {
    throw new Error("Customer mobile is missing.");
  }

  const [existing] = await db.query(
    `${USER_WITH_ROLE} WHERE u.phone = ? LIMIT 1`,
    [phone]
  );
  const current = existing[0];

  let userId;
  if (current) {
    userId = current.id;
    if (current.role === "customer") {
      await db.execute(
        `UPDATE users
         SET name = ?, role_id = ?, status = 'active', lead_id = ?
         WHERE id = ?`,
        [name, customerRoleId, lead.id, userId]
      );
    } else {
      await db.execute("UPDATE users SET lead_id = ? WHERE id = ? AND lead_id IS NULL", [
        lead.id,
        userId,
      ]);
    }
  } else {
    const [result] = await db.execute(
      `INSERT INTO users (name, email, phone, password_hash, role_id, status, lead_id)
       VALUES (?, NULL, ?, NULL, ?, 'active', ?)`,
      [name, phone, customerRoleId, lead.id]
    );
    userId = result.insertId;
  }

  await db.execute("UPDATE leads SET user_id = ? WHERE id = ?", [userId, lead.id]);
  return userId;
}
