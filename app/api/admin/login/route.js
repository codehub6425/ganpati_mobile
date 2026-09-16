import { NextResponse } from "next/server";
import { applySessionCookie, createSessionToken, loginWithPassword } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db";

export async function POST(request) {
  try {
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
  } catch (error) {
    console.error("admin login", error);
    return NextResponse.json(
      {
        ok: false,
        message: dbErrorMessage(error, "Login is temporarily unavailable. Please try again."),
      },
      { status: 503 }
    );
  }
}
