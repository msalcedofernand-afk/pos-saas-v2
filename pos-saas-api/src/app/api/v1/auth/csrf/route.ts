import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getOrCreateCsrfToken(request);
  const response = NextResponse.json({ data: { csrfToken: token } });
  return setCsrfCookie(response, token);
}
