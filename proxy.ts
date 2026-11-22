import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CSP_NONCE_HEADER, buildCsp, generateCspNonce } from "@/lib/security/csp";

const LOGIN_PATH = "/admin/login";

// Next 16's name for middleware. Two jobs: a Content-Security-Policy with a
// fresh nonce on every response, and keeping signed-out visitors off the
// panel. It is a convenience, not the authorization: each page and each
// Server Action checks the role again for itself (lib/auth/guards.ts).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const nonce = generateCspNonce();
  const csp = buildCsp(nonce);

  // Next reads the nonce from the request's own CSP header and stamps it on
  // the scripts it emits; the layout reads it from the second header.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const secured = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };
  const next = () => secured(NextResponse.next({ request: { headers: requestHeaders } }));

  if (!pathname.startsWith("/admin")) return next();

  const user = req.auth?.user;
  const signedIn = !!user && !user.revoked;

  if (pathname === LOGIN_PATH) {
    return signedIn ? secured(NextResponse.redirect(new URL("/admin", req.nextUrl))) : next();
  }
  return signedIn ? next() : secured(NextResponse.redirect(new URL(LOGIN_PATH, req.nextUrl)));
});

export const config = {
  // Every route except Next's own static assets, so the public pages carry
  // the policy too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
