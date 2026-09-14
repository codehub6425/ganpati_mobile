import { NextResponse } from "next/server";
import { applySessionCookie, createSessionToken, loginWithPassword } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "");
  const password = String(body.password || "");

  const user = await loginWithPassword(email, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Invalid email or password." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, role: user.role });
  applySessionCookie(response.cookies, createSessionToken(user));
  return response;
}
