import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import { whatsappJsonPayload } from "@/lib/whatsapp-api";
import { whatsappPair, whatsappStart } from "@/lib/whatsapp-gateway";

export async function POST(request) {
  const user = await getSessionUser();
  if (!canManageUsers(user)) {
    return NextResponse.json({ ok: false, message: "Only an admin can connect WhatsApp." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const phone = String(body.phone || "").trim();
  const code = String(body.code || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  if (code && code.length !== 8) {
    return NextResponse.json(
      {
        ...whatsappJsonPayload(
          {
            status: "disconnected",
            phone: null,
            qr: null,
            pairing_code: null,
            pairing_phone: null,
            error: "Enter the 8-character code, for example A5CM-9EA1.",
            gateway: true,
          },
          false
        ),
        message: "Enter the 8-character code, for example A5CM-9EA1.",
      },
      { status: 422 }
    );
  }

  try {
    if (phone) {
      let digits = phone.replace(/\D/g, "");
      if (digits.length === 10) digits = `91${digits}`;
      if (digits.length < 11 || digits.length > 15) {
        return NextResponse.json(
          {
            ...whatsappJsonPayload(
              {
                status: "disconnected",
                phone: null,
                qr: null,
                pairing_code: null,
                pairing_phone: null,
                error: "Enter the shop WhatsApp number with country code.",
                gateway: true,
              },
              false
            ),
            message: "Enter the shop WhatsApp number with country code.",
          },
          { status: 422 }
        );
      }
      const state = await whatsappPair(digits, code || null);
      return NextResponse.json(whatsappJsonPayload(state, !state.error || state.status === "qr" || state.status === "pairing" || state.status === "connected"));
    }

    const state = await whatsappStart(true);
    return NextResponse.json(whatsappJsonPayload(state));
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, message: error.message || "Could not connect WhatsApp." },
      { status: 500 }
    );
  }
}
