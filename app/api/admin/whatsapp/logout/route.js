import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import { whatsappJsonPayload } from "@/lib/whatsapp-api";
import { whatsappLogout } from "@/lib/whatsapp-gateway";

export async function POST() {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can disconnect WhatsApp." }, { status: 403 });
  }

  try {
    const state = await whatsappLogout();
    return NextResponse.json(whatsappJsonPayload(state));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, message: "Logout failed." }, { status: 500 });
  }
}
