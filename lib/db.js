import mysql from "mysql2/promise";
import { hashPassword } from "./password.js";

const CREATE_LEADS = `
  CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    phone VARCHAR(10) NOT NULL,
    brand VARCHAR(30) NOT NULL,
    problem VARCHAR(30) NOT NULL,
    note VARCHAR(120) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    accuracy_m INT NULL,
    distance_km DECIMAL(8,2) NULL,
    device VARCHAR(20) NULL,
    user_agent VARCHAR(255) NULL,
    ip_address VARCHAR(64) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_FOLLOW_UPS = `
  CREATE TABLE IF NOT EXISTS follow_ups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    follow_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    follow_at DATETIME NULL,
    note VARCHAR(200) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY lead_idx (lead_id)
  )
`;

const CREATE_ROLES = `
  CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(30) NOT NULL,
    name VARCHAR(40) NOT NULL,
    UNIQUE KEY unique_slug (slug)
  )
`;

const CREATE_USERS = `
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(120) NULL,
    phone VARCHAR(10) NULL,
    password_hash VARCHAR(255) NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0,
    role_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    lead_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_email (email),
    UNIQUE KEY unique_phone (phone),
    KEY role_id_idx (role_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
  )
`;

const SCHEMA_VERSION = 12;

const CREATE_COMMISSION_RULES = `
  CREATE TABLE IF NOT EXISTS commission_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_key VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    calc_type VARCHAR(10) NOT NULL DEFAULT 'percent',
    rate DECIMAL(10,4) NULL,
    slab_base DECIMAL(12,2) NULL,
    slab_value DECIMAL(12,2) NULL,
    base_field VARCHAR(20) NOT NULL DEFAULT 'amount',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rule_key (rule_key)
  )
`;

const CREATE_DAY_BOOKS = `
  CREATE TABLE IF NOT EXISTS day_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_date DATE NOT NULL,
    note VARCHAR(200) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_book_date (book_date),
    KEY created_by_idx (created_by)
  )
`;

const CREATE_LEDGER_ENTRIES = `
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_book_id INT NOT NULL,
    category VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    transfer_amount DECIMAL(12,2) NULL,
    mt_subtype VARCHAR(20) NULL,
    provider VARCHAR(40) NULL,
    description VARCHAR(200) NULL,
    payment_method VARCHAR(20) NULL,
    lead_id INT NULL,
    customer_phone VARCHAR(10) NULL,
    device_brand VARCHAR(40) NULL,
    payment_flow VARCHAR(10) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY day_category_idx (day_book_id, category),
    KEY lead_idx (lead_id),
    CONSTRAINT fk_ledger_day_book FOREIGN KEY (day_book_id) REFERENCES day_books(id) ON DELETE CASCADE
  )
`;

const EXTRA_COLUMNS = [
  ["latitude", "DECIMAL(10,7) NULL"],
  ["longitude", "DECIMAL(10,7) NULL"],
  ["accuracy_m", "INT NULL"],
  ["distance_km", "DECIMAL(8,2) NULL"],
  ["device", "VARCHAR(20) NULL"],
  ["user_agent", "VARCHAR(255) NULL"],
  ["ip_address", "VARCHAR(64) NULL"],
  ["status", "VARCHAR(20) NOT NULL DEFAULT 'new'"],
  ["verified_at", "TIMESTAMP NULL"],
  ["follow_status", "VARCHAR(20) NULL"],
  ["follow_at", "DATETIME NULL"],
  ["follow_note", "VARCHAR(200) NULL"],
  ["follow_updated_at", "TIMESTAMP NULL"],
  ["user_id", "INT NULL"],
];

const globalStore = globalThis;

export async function getRoleId(db, slug) {
  const [rows] = await db.query("SELECT id FROM roles WHERE slug = ? LIMIT 1", [slug]);
  return Number(rows[0]?.id) || null;
}

export function getPool() {
  if (!globalStore.__gmpPool) {
    globalStore.__gmpPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "ganpti_mobile",
      waitForConnections: true,
      connectionLimit: 3,
      maxIdle: 2,
      idleTimeout: 20000,
      queueLimit: 20,
      enableKeepAlive: true,
    });
  }
  return globalStore.__gmpPool;
}

export async function upsertAdminFromEnv(db = getPool()) {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) return null;

  const adminRoleId = await getRoleId(db, "admin");
  if (!adminRoleId) return null;

  const hash = hashPassword(password);
  const [rows] = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (rows[0]) {
    await db.execute(
      `UPDATE users
       SET name = ?, password_hash = ?, role_id = ?, status = 'active'
       WHERE id = ?`,
      ["Shubham", hash, adminRoleId, rows[0].id]
    );
    const [fresh] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, u.role_id, r.slug AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [rows[0].id]
    );
    return fresh[0] || null;
  }

  await db.execute(
    `INSERT INTO users (name, email, phone, password_hash, role_id, status)
     VALUES (?, ?, NULL, ?, ?, 'active')`,
    ["Shubham", email, hash, adminRoleId]
  );
  const [created] = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.status, u.role_id, r.slug AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?
     LIMIT 1`,
    [email]
  );
  return created[0] || null;
}

async function seedRoles(db) {
  await db.query(`
    INSERT INTO roles (slug, name)
    VALUES ('admin', 'Admin'), ('staff', 'Staff'), ('customer', 'Customer')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);
}

async function addUserColumns(db) {
  const extra = [
    ["role_id", "INT NULL"],
    ["lead_id", "INT NULL"],
    ["password_hash", "VARCHAR(255) NULL"],
  ];
  for (const [name, def] of extra) {
    try {
      await db.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
  try {
    await db.query("ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL");
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
  }
}

async function normalizeUserRoleId(db) {
  await backfillRoleIds(db);
  try {
    await db.query("ALTER TABLE users DROP COLUMN role");
  } catch (error) {
    if (error.code !== "ER_CANT_DROP_FIELD_OR_KEY" && error.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
  }
  try {
    await db.query("ALTER TABLE users MODIFY COLUMN role_id INT NOT NULL AFTER password_hash");
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
  }
  try {
    await db.query("ALTER TABLE roles ENGINE=InnoDB");
    await db.query("ALTER TABLE users ENGINE=InnoDB");
  } catch {
    // already InnoDB
  }
  try {
    await db.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
    `);
  } catch (error) {
    if (
      error.code !== "ER_DUP_KEYNAME" &&
      error.code !== "ER_FK_DUP_NAME" &&
      error.errno !== 1826 &&
      error.errno !== 121
    ) {
      throw error;
    }
  }
}

async function backfillRoleIds(db) {
  try {
    await db.query(`
      UPDATE users u
      JOIN roles r ON r.slug = COALESCE(NULLIF(u.role, ''), 'customer')
      SET u.role_id = r.id
      WHERE u.role_id IS NULL
    `);
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
  }
  await db.query(`
    UPDATE users
    SET role_id = (SELECT id FROM roles WHERE slug = 'customer' LIMIT 1)
    WHERE role_id IS NULL
  `);
}

async function seedAdminUser(db) {
  await upsertAdminFromEnv(db);
}

async function migrateVerifiedLeadsToUsers(db) {
  const customerRoleId = await getRoleId(db, "customer");
  if (!customerRoleId) return;

  await db.query(
    `
      INSERT INTO users (name, phone, role_id, status, lead_id)
      SELECT name, phone, ?, 'active', id
      FROM leads
      WHERE status = 'verified'
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        lead_id = VALUES(lead_id),
        role_id = VALUES(role_id)
    `,
    [customerRoleId]
  );

  try {
    await db.query(`
      UPDATE leads l
      JOIN users u ON u.phone = l.phone
      JOIN roles r ON r.id = u.role_id AND r.slug = 'customer'
      SET l.user_id = u.id
      WHERE l.status = 'verified'
    `);
  } catch (error) {
    if (error.code !== "ER_BAD_FIELD_ERROR") throw error;
  }
}

async function seedCommissionRules(db) {
  await db.query(CREATE_COMMISSION_RULES);
  const defaults = [
    {
      rule_key: "money_transfer_mt",
      label: "Money transfer (M/T)",
      calc_type: "percent",
      rate: 1,
      slab_base: null,
      slab_value: null,
      base_field: "transfer_amount",
    },
    {
      rule_key: "money_transfer_redem",
      label: "Redeem",
      calc_type: "slab",
      rate: null,
      slab_base: 100,
      slab_value: 10,
      base_field: "amount",
    },
    {
      rule_key: "recharge",
      label: "Recharge",
      calc_type: "percent",
      rate: 2.5,
      slab_base: null,
      slab_value: null,
      base_field: "amount",
    },
  ];
  for (const row of defaults) {
    await db.execute(
      `INSERT INTO commission_rules (rule_key, label, calc_type, rate, slab_base, slab_value, base_field)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [
        row.rule_key,
        row.label,
        row.calc_type,
        row.rate,
        row.slab_base,
        row.slab_value,
        row.base_field,
      ]
    );
  }
}

async function migrateCustomersToUsers(db) {
  const customerRoleId = await getRoleId(db, "customer");
  if (!customerRoleId) return;
  try {
    await db.query(
      `
        INSERT INTO users (name, phone, role_id, status, lead_id)
        SELECT name, phone, ?, 'active', lead_id
        FROM customers
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          lead_id = VALUES(lead_id),
          role_id = VALUES(role_id)
      `,
      [customerRoleId]
    );
  } catch (error) {
    if (error.code !== "ER_NO_SUCH_TABLE") throw error;
  }
}

export async function ensureLeadsTable() {
  if (globalStore.__gmpSchema === SCHEMA_VERSION) return;
  const db = getPool();
  try {
    await db.query(CREATE_LEADS);
    await db.query(CREATE_ROLES);
    await db.query(CREATE_USERS);
    await seedRoles(db);
    await addUserColumns(db);
    await db.query(CREATE_FOLLOW_UPS);
    for (const [name, def] of EXTRA_COLUMNS) {
      try {
        await db.query(`ALTER TABLE leads ADD COLUMN ${name} ${def}`);
      } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") throw error;
      }
    }
    await backfillRoleIds(db);
    await normalizeUserRoleId(db);
    await migrateCustomersToUsers(db);
    await migrateVerifiedLeadsToUsers(db);
    await seedAdminUser(db);
    await db.query(CREATE_DAY_BOOKS);
    await db.query(CREATE_LEDGER_ENTRIES);
    try {
      await db.query("ALTER TABLE ledger_entries ADD COLUMN customer_phone VARCHAR(10) NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    try {
      await db.query("ALTER TABLE ledger_entries ADD COLUMN device_brand VARCHAR(40) NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    try {
      await db.query("ALTER TABLE ledger_entries ADD COLUMN payment_flow VARCHAR(10) NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    try {
      await db.query(
        "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0"
      );
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    await seedCommissionRules(db);
    try {
      await db.query("ALTER TABLE ledger_entries ADD COLUMN commission_amount DECIMAL(12,2) NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    try {
      await db.query(
        "ALTER TABLE ledger_entries ADD COLUMN commission_manual TINYINT(1) NOT NULL DEFAULT 0"
      );
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
    globalStore.__gmpSchema = SCHEMA_VERSION;
  } catch (error) {
    console.error("ensureLeadsTable", error.code, error.sqlMessage || error.message);
    throw error;
  }
}

export function dbErrorMessage(error, fallback) {
  if (error?.code === "ER_CON_COUNT_ERROR") {
    return "MySQL has too many connections. Restart MySQL in WAMP, then refresh this page.";
  }
  if (error?.code === "ECONNREFUSED") {
    const db = process.env.MYSQL_DATABASE || "ganpti_mobile";
    return `Could not connect to MySQL on ${process.env.MYSQL_HOST || "127.0.0.1"}:${process.env.MYSQL_PORT || 3306}. Start WAMP (MySQL service) and ensure database "${db}" exists.`;
  }
  if (error?.code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL rejected the username or password. Check MYSQL_USER and MYSQL_PASSWORD in .env.local.";
  }
  return fallback;
}
