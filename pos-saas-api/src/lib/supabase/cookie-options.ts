import type { CookieOptions } from "@supabase/ssr";

const sameSiteValues = ["lax", "strict", "none"] as const;
type SameSite = (typeof sameSiteValues)[number];

function getSameSite(): SameSite {
  const value = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  return sameSiteValues.includes(value as SameSite) ? (value as SameSite) : "lax";
}

function getSecure(sameSite: SameSite) {
  const configured = process.env.AUTH_COOKIE_SECURE?.toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;

  // SameSite=None is rejected by browsers unless Secure is also enabled.
  return sameSite === "none" || process.env.NODE_ENV === "production";
}

export function getAuthCookieOptions(): CookieOptions {
  const sameSite = getSameSite();

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure: getSecure(sameSite),
  };
}

export function getCsrfCookieOptions(): CookieOptions {
  return {
    ...getAuthCookieOptions(),
    httpOnly: false,
    maxAge: 60 * 60 * 8,
  };
}
