import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin protected routes - check for admin session cookie
  if (pathname.startsWith("/mgt-p4s7n/app")) {
    const adminSession = request.cookies.get("admin_session");
    if (!adminSession) {
      return NextResponse.redirect(new URL("/mgt-p4s7n/login", request.url));
    }
  }

  // Admin API routes protection
  if (
    pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/auth/admin")
  ) {
    const adminSession = request.cookies.get("admin_session");
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // User protected routes (except auth routes)
  if (
    pathname.match(/^\/(?!mgt-p4s7n|api|_next|favicon)/) &&
    pathname !== "/"
  ) {
    const userSession = request.cookies.get("user_session");
    if (!userSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
