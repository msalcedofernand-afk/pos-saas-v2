import { NextResponse, type NextRequest } from "next/server";

const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
).origin;

function buildCsp(nonce?: string) {
  const scriptSource = process.env.NODE_ENV === "production"
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSource}`,
    `connect-src 'self' ${apiOrigin}`,
  ].join("; ");
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", buildCsp());
    return response;
  }

  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
