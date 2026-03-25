import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight middleware that protects /dashboard and /onboarding.
 *
 * We intentionally do NOT import Prisma here because middleware runs in the
 * Edge Runtime, which doesn't support Node.js built-in modules (node:path,
 * node:url) that Prisma v7's generated client requires.
 *
 * Instead we check for the NextAuth session cookie. The actual auth +
 * onboarding state checks happen in the page server components.
 */
export function middleware(request: NextRequest) {
  // NextAuth v5 database session cookie
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/onboarding"],
};
