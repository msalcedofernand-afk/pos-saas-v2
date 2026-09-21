import type { NextRequest, NextResponse } from "next/server";
import { getCsrfCookieOptions } from "@/lib/supabase/cookie-options";

export const CSRF_COOKIE_NAME = "pos_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isProtectedMethod(method: string) {
  return protectedMethods.has(method.toUpperCase());
}

export function isCsrfExemptPath(pathname: string) {
  return pathname === "/api/v1/auth/login" || pathname === "/api/v1/auth/csrf";
}

export function createCsrfToken() {
  return crypto.randomUUID();
}

export function getOrCreateCsrfToken(request: Request) {
  const existing = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`))?.[1];
  return existing || createCsrfToken();
}

export function setCsrfCookie(response: NextResponse, token: string) {
  response.cookies.set(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return response;
}

export function hasValidCsrfToken(request: NextRequest) {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}
