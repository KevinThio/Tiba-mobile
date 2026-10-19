import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Fast, optimistic check: no session cookie means straight to sign-in.
// This does NOT validate the session. Pages and Server Actions must still call
// requireClinician() from src/lib/auth.ts before touching patient data.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|sign-in|sign-up|_next/static|_next/image|icons|icon.svg|manifest.webmanifest|favicon.ico).*)",
  ],
};
