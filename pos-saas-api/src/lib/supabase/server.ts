import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and a publishable Supabase key must be set");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              ...getAuthCookieOptions(),
            }),
          );
        } catch {
          // Called from a Server Component — safe to ignore
        }
      },
    },
  });
}
