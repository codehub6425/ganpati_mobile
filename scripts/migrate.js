/**
 * Run DB schema setup / migrations (ensureLeadsTable).
 * Usage: npm run migrate
 * Loads .env.local, .env, then .env.production if present.
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = path.join(__dirname, "..");

function loadEnvFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile(".env.production");

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    let resolved = path.join(root, request.slice(2));
    if (!path.extname(resolved) && fs.existsSync(`${resolved}.js`)) {
      resolved = `${resolved}.js`;
    }
    request = resolved;
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

async function main() {
  const db = await import("../lib/db.js");
  await db.ensureLeadsTable();
  const pool = db.getPool();
  if (typeof pool.end === "function") {
    await pool.end();
  }
  console.log("Migration finished successfully (ensureLeadsTable).");
}

main().catch((err) => {
  console.error("Migration failed:", err.sqlMessage || err.message || err);
  process.exit(1);
});
