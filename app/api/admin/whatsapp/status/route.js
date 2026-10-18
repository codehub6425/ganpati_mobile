import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { whatsappJsonPayload } from "@/lib/whatsapp-api";
import { whatsappStatus } from "@/lib/whatsapp-gateway";
import { isStaffUser } from "@/lib/roles";

export async function GET() {
  const user = await getSessionUser();
  if (!isStaffUser(user)) {
    return NextResponse.json({ ok: false, message: "Login required." }, { status: 401 });
  }

  const state = await whatsappStatus();
  return NextResponse.json(whatsappJsonPayload(state));
}
