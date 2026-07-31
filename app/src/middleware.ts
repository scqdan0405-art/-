import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { decodeJwtPayload, hasRole, mustChangePassword } from "@/lib/auth/jwt";

const STORE_PUBLIC_PATHS = new Set(["/store/login", "/store/change-password"]);

function hidden() {
  return new NextResponse("Not found", { status: 404 });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  const claims = decodeJwtPayload(token);

  if (pathname.startsWith("/store")) {
    if (STORE_PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next();
    }

    if (!hasRole(claims, "store")) {
      return hidden();
    }

    if (mustChangePassword(claims)) {
      return NextResponse.redirect(new URL("/store/change-password", request.url));
    }
  }

  if (pathname.startsWith("/admin") && !hasRole(claims, "admin")) {
    return hidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/store/:path*", "/admin/:path*"]
};
