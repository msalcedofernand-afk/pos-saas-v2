import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicApiRoute = pathname === "/api/v1/health";

  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  const supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Permite mostrar las pantallas públicas en instalaciones aún no configuradas.
  // Las rutas API protegidas no se consideran disponibles sin credenciales.
  if (!supabaseUrl || !supabasePublishableKey) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: { code: "SUPABASE_NOT_CONFIGURED", message: "La API no está configurada" } },
        { status: 503 },
      );
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            ...getAuthCookieOptions(),
          }),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !isPublicApiRoute &&
    !isApiRoute &&
    pathname !== "/login" &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/api/auth/callback") &&
    !pathname.startsWith("/api/auth/users") &&
    !pathname.startsWith("/api/db/clear-other-sessions")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
