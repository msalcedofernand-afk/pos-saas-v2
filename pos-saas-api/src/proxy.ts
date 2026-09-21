import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { hasValidCsrfToken, isCsrfExemptPath, isProtectedMethod } from "@/lib/security/csrf";

const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3001";

function addVaryOrigin(response: NextResponse) {
  const vary = response.headers.get("Vary");
  if (!vary) {
    response.headers.set("Vary", "Origin");
  } else if (!vary.split(",").some((value) => value.trim().toLowerCase() === "origin")) {
    response.headers.set("Vary", `${vary}, Origin`);
  }
}

export async function proxy(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const origin = request.headers.get("origin");

  if (isApiRoute && request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Cache-Control", "no-store");
    if (origin === allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
    }
    addVaryOrigin(response);
    return response;
  }

  if (
    isApiRoute &&
    isProtectedMethod(request.method) &&
    !isCsrfExemptPath(request.nextUrl.pathname) &&
    !hasValidCsrfToken(request)
  ) {
    const response = NextResponse.json(
      { error: { code: "CSRF_VALIDATION_FAILED", message: "Token CSRF inválido o ausente" } },
      { status: 403 },
    );
    response.headers.set("Cache-Control", "no-store");
    addVaryOrigin(response);
    if (origin === allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return response;
  }

  const response = await updateSession(request);
  if (isApiRoute) {
    response.headers.set("Cache-Control", "no-store");
    addVaryOrigin(response);
    if (origin === allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
