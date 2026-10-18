import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureLeadsTable, getPool } from "@/lib/db";
import { canManageUsers } from "@/lib/roles";
import {
  loadMessageTemplates,
  saveMessageTemplate,
  TEMPLATE_PLACEHOLDERS,
} from "@/lib/whatsapp-templates";

export async function GET() {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can view templates." }, { status: 403 });
  }

  try {
    await ensureLeadsTable();
    const templates = await loadMessageTemplates(getPool());
    return NextResponse.json({ ok: true, templates, placeholders: TEMPLATE_PLACEHOLDERS });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not load templates." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can edit templates." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const template_key = String(body.template_key || "").trim();
  const templateBody = body.body;

  try {
    await ensureLeadsTable();
    const result = await saveMessageTemplate(template_key, templateBody, getPool());
    if (result.error) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }
    const templates = await loadMessageTemplates(getPool());
    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Could not save template." }, { status: 500 });
  }
}
