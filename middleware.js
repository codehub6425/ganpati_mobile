import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  refreshSessionToken,
  sessionCookieOptions,
} from "@/lib/session-edge";

function isAdminArea(pathname) {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function isLoginPath(pathname) {
  return pathname === "/admin/login" || pathname.startsWith("/admin/login/");
}

export async function middleware(request) {
  try {
    const { pathname } = request.nextUrl;
    if (!isAdminArea(pathname) || isLoginPath(pathname)) {
      return NextResponse.next();
    }

    const raw = request.cookies.get(COOKIE_NAME)?.value;
    const newToken = await refreshSessionToken(raw || "");
    if (!newToken || typeof newToken !== "string") {
      return NextResponse.next();
    }

    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, newToken, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error("middleware session refresh", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
