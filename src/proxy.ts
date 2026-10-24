import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Fast, optimistic check: no session cookie means straight to sign-in.
// This does NOT validate the session. Pages and Server Actions must still call
// requireClinician() from src/lib/auth.ts before touching patient data.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    // Come back to this page after signing in (sign-in checks it stays inside Tiba).
    const signIn = new URL("/sign-in", request.url);
    const { pathname, search } = request.nextUrl;
    if (pathname !== "/") signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/assistant|sign-in|sign-up|forgot-password|reset-password|review|_next/static|_next/image|icons|icon.svg|manifest.webmanifest|favicon.ico).*)",
  ],
};
