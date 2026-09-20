import { titleCase } from "@/lib/format";
import { normalizeCustomerPhone } from "@/lib/ledger";

export const USER_WITH_ROLE = `
  SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, u.lead_id, u.role_id, u.created_at,
         u.must_change_password,
         r.slug AS role, r.name AS role_name
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
`;

export async function findUserByPhone(db, phone) {
  const normalized = normalizeCustomerPhone(phone);
  if (!normalized) return null;
  const [rows] = await db.query(`${USER_WITH_ROLE} WHERE u.phone = ? LIMIT 1`, [normalized]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: titleCase(row.name),
    phone: row.phone,
    role: row.role,
  };
}

/** Save or update a customer when linking mobile from Daily Accounts. */
export async function ensureCustomerForLedger(db, { phone, name }) {
  const normalized = normalizeCustomerPhone(phone);
  if (!normalized) {
    return { error: "Enter a valid 10-digit mobile number." };
  }

  const existing = await findUserByPhone(db, normalized);
  const trimmedName = titleCase(String(name || "").trim());

  if (existing) {
    if (existing.role === "customer") {
      if (trimmedName && trimmedName !== existing.name) {
        await db.execute("UPDATE users SET name = ?, status = 'active' WHERE id = ?", [
          trimmedName,
          existing.id,
        ]);
        return { userId: existing.id, name: trimmedName, created: false };
      }
      return { userId: existing.id, name: existing.name, created: false };
    }
    return { userId: existing.id, name: existing.name, created: false, linkedOnly: true };
  }

  if (!trimmedName) {
    return { error: "Enter customer name — this mobile is not saved yet." };
  }

  const [roleRows] = await db.query("SELECT id FROM roles WHERE slug = 'customer' LIMIT 1");
  const customerRoleId = Number(roleRows[0]?.id) || null;
  if (!customerRoleId) {
    return { error: "Customer role is missing." };
  }

  const [result] = await db.execute(
    `INSERT INTO users (name, email, phone, password_hash, role_id, status, lead_id)
     VALUES (?, NULL, ?, NULL, ?, 'active', NULL)`,
    [trimmedName, normalized, customerRoleId]
  );

  return { userId: result.insertId, name: trimmedName, created: true };
}

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
