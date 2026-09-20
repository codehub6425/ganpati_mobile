import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  COMMISSION_CALC_TYPES,
  COMMISSION_BASE_FIELDS,
  formatRuleRow,
  loadCommissionRules,
} from "@/lib/commission";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  try {
    await ensureLeadsTable();
    const rules = await loadCommissionRules(getPool());
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load commission rules." }, { status: 500 });
  }
}

function normalizeRulePatch(raw) {
  const calc_type = String(raw.calc_type || "percent").toLowerCase();
  if (!COMMISSION_CALC_TYPES.includes(calc_type)) {
    return { error: "Invalid calculation type." };
  }
  const base_field = String(raw.base_field || "amount").toLowerCase();
  if (!COMMISSION_BASE_FIELDS.includes(base_field)) {
    return { error: "Invalid base field." };
  }

  const rate =
    raw.rate != null && raw.rate !== "" ? Number(raw.rate) : null;
  const slab_base =
    raw.slab_base != null && raw.slab_base !== "" ? Number(raw.slab_base) : null;
  const slab_value =
    raw.slab_value != null && raw.slab_value !== "" ? Number(raw.slab_value) : null;

  if (calc_type === "percent" || calc_type === "fixed") {
    if (rate == null || !Number.isFinite(rate) || rate < 0) {
      return { error: "Enter a valid rate." };
    }
  }
  if (calc_type === "slab") {
    if (
      slab_base == null ||
      !Number.isFinite(slab_base) ||
      slab_base <= 0 ||
      slab_value == null ||
      !Number.isFinite(slab_value) ||
      slab_value < 0
    ) {
      return { error: "Enter valid slab base and commission values." };
    }
  }

  return {
    rule: {
      calc_type,
      rate: calc_type === "slab" ? null : rate,
      slab_base: calc_type === "slab" ? slab_base : null,
      slab_value: calc_type === "slab" ? slab_value : null,
      base_field,
      is_active: raw.is_active === false || raw.is_active === 0 ? 0 : 1,
    },
  };
}

export async function PATCH(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }
  if (!canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can change commission settings." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ruleKey = String(body.rule_key || "").trim();
  if (!ruleKey) {
    return NextResponse.json({ ok: false, message: "Missing rule." }, { status: 400 });
  }

  const normalized = normalizeRulePatch(body);
  if (normalized.error) {
    return NextResponse.json({ ok: false, message: normalized.error }, { status: 400 });
  }

  try {
    await ensureLeadsTable();
    const db = getPool();
    const r = normalized.rule;
    const [result] = await db.execute(
      `UPDATE commission_rules
       SET calc_type = ?, rate = ?, slab_base = ?, slab_value = ?, base_field = ?, is_active = ?
       WHERE rule_key = ?`,
      [r.calc_type, r.rate, r.slab_base, r.slab_value, r.base_field, r.is_active, ruleKey]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ ok: false, message: "Rule not found." }, { status: 404 });
    }
    const [rows] = await db.query("SELECT * FROM commission_rules WHERE rule_key = ? LIMIT 1", [ruleKey]);
    return NextResponse.json({ ok: true, rule: formatRuleRow(rows[0]) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not save commission rule." }, { status: 500 });
  }
}
