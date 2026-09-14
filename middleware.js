import { NextResponse } from "next/server";
import { applySessionCookie, refreshSessionToken } from "@/lib/auth";

export function middleware(request) {
  if (request.nextUrl.pathname.endsWith("/logout")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const current = request.cookies.get("gmp_admin")?.value;
  const refreshed = refreshSessionToken(current);
  if (refreshed) {
    applySessionCookie(response.cookies, refreshed);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
