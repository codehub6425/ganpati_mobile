/**
 * Smoke test: gateway + template render (no real WhatsApp send unless --send and connected).
 * Usage: node scripts/test-whatsapp-flow.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const file = path.join(root, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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

loadEnvLocal();

const { whatsappConfigured, whatsappStatus } = await import("../lib/whatsapp-gateway.js");
const { loadTemplateByKey, renderTemplateBody, shopNameFromEnv } = await import(
  "../lib/whatsapp-templates.js"
);
const { ensureLeadsTable } = await import("../lib/db.js");

console.log("1) Env configured:", whatsappConfigured());
if (!whatsappConfigured()) {
  console.error("   Missing WHATSAPP_GATEWAY_SECRET or URL in .env.local");
  process.exit(1);
}

try {
  const health = await fetch(`${process.env.WHATSAPP_GATEWAY_URL.replace(/\/$/, "")}/health`);
  const healthJson = await health.json();
  console.log("2) Gateway /health:", health.status, healthJson);
} catch (e) {
  console.error("2) Gateway /health FAILED:", e.message);
  process.exit(1);
}

const state = await whatsappStatus();
console.log("3) Session status (shop", process.env.WHATSAPP_SHOP_ID + "):", {
  status: state.status,
  phone: state.phone,
  gateway: state.gateway,
  error: state.error,
});

await ensureLeadsTable();
const template = await loadTemplateByKey("accessory_bill");
console.log("4) Template loaded:", template?.template_key, template?.body?.slice(0, 40) + "...");

const sample = renderTemplateBody(template.body, {
  customer_name: "Test Customer",
  shop_name: shopNameFromEnv(),
  shop_phone: "",
  shop_phone_line: "",
  date: "18 Oct 2026",
  items_block: "• Charger — ₹199",
  total: "199",
  payment_method: "CASH",
});
console.log("5) Rendered sample message:\n---\n" + sample + "\n---");

console.log("\nOK — configure WhatsApp in Admin → Settings if status is not connected.");
